import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import bcrypt from "bcryptjs";
import express from "express";
import nodemailer from "nodemailer";
import { User } from "../../dist/models/User.js";
import { authRouter } from "../../dist/routes/auth.routes.js";

test("password recovery emails a link and accepts an active token only once", async (t) => {
  process.env.CLIENT_URL = "https://pizza.example.test";
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "465";
  process.env.EMAIL_FROM = "pizza@example.test";

  const email = "fan@example.test";
  const oldPassword = "original-password";
  const account = new User({ name: "Pizza fan", email, passwordHash: await bcrypt.hash(oldPassword, 4) });
  const sent = [];
  t.mock.method(nodemailer, "createTransport", (options) => {
    assert.equal(options.secure, true);
    return { sendMail: async (message) => sent.push(message) };
  });

  const matchesResetToken = (filter) =>
    account.passwordResetTokenHash === filter.passwordResetTokenHash &&
    account.passwordResetExpires > filter.passwordResetExpires.$gt;
  t.mock.method(User, "exists", async (filter) => matchesResetToken(filter) ? { _id: account._id } : null);
  t.mock.method(User, "updateOne", async (filter, update) => {
    const matches = filter.email ? account.email === filter.email : matchesResetToken(filter);
    if (!matches) return { matchedCount: 0, modifiedCount: 0 };
    account.set(update.$set);
    for (const field of Object.keys(update.$unset ?? {})) account.set(field, undefined);
    return { matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(User, "findOne", (filter) => ({
    select: async () => account.email === filter.email ? account : null,
  }));

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const post = (path, body) => fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const unknown = await post("forgot-password", { email: "unknown@example.test" });
  const known = await post("forgot-password", { email: email.toUpperCase() });
  assert.equal(unknown.status, 200);
  assert.equal(known.status, 200);
  assert.deepEqual(await known.json(), await unknown.json());
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, email);
  const resetUrl = new URL(sent[0].text.match(/https:\/\/\S+/)[0]);
  assert.equal(resetUrl.origin, "https://pizza.example.test");
  assert.equal(resetUrl.pathname, "/reset-password");
  assert.ok(sent[0].html.includes(`href="${resetUrl}"`));
  const token = new URLSearchParams(resetUrl.hash.slice(1)).get("token");
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(account.passwordResetTokenHash, createHash("sha256").update(token).digest("hex"));

  const newPasswords = ["updated-password-1", "updated-password-2"];
  const reset = (password) => post("reset-password", { token, password });
  const expiry = account.passwordResetExpires;
  assert.ok(expiry > new Date());
  account.passwordResetExpires = new Date(Date.now() - 1000);
  assert.equal((await reset(newPasswords[0])).status, 400);
  account.passwordResetExpires = expiry;

  const attempts = await Promise.all(newPasswords.map(reset));
  assert.deepEqual(attempts.map(({ status }) => status).sort(), [200, 400]);
  assert.equal(account.passwordResetTokenHash, undefined);
  assert.equal(account.passwordResetExpires, undefined);
  assert.equal((await reset(newPasswords[0])).status, 400);

  const winningPassword = newPasswords[attempts.findIndex(({ status }) => status === 200)];
  assert.equal((await post("login", { email, password: oldPassword })).status, 401);
  assert.equal((await post("login", { email, password: winningPassword })).status, 200);
});
