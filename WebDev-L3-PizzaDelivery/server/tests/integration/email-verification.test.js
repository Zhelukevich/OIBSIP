import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { createApp } from "../../dist/app.js";
import { User } from "../../dist/models/User.js";

function setEnvironment(t, values) {
  for (const [name, value] of Object.entries(values)) {
    const before = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    t.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }
}

async function startApi(t) {
  setEnvironment(t, { JWT_SECRET: "email-verification-test-secret" });
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");

  return (path, { body, token } = {}) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const credentials = { name: "Pizza fan", email: "FAN@example.test", password: "a-test-password", role: "admin" };

test("registration sends an expiring link that can be used only once, then checkout accepts the same JWT", async (t) => {
  setEnvironment(t, {
    NODE_ENV: "production",
    CLIENT_URL: "https://pizza.example.test",
    SMTP_HOST: "smtp.example.test",
    EMAIL_FROM: "pizza@example.test",
  });
  let account;
  const sent = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => sent.push(message) }));
  t.mock.method(User, "create", async (fields) => {
    if (account) throw Object.assign(new Error("Duplicate email"), { code: 11000 });
    account = new User(fields);
    return account;
  });
  t.mock.method(User, "updateOne", async (filter, update) => {
    if (account.emailVerified !== filter.emailVerified ||
        account.emailVerificationTokenHash !== filter.emailVerificationTokenHash ||
        !(account.emailVerificationExpires > filter.emailVerificationExpires.$gt)) {
      return { modifiedCount: 0 };
    }
    account.set(update.$set);
    for (const field of Object.keys(update.$unset)) account.set(field, undefined);
    return { modifiedCount: 1 };
  });
  t.mock.method(User, "exists", async (filter) =>
    account.id === filter._id && account.emailVerified === filter.emailVerified ? { _id: account._id } : null,
  );
  t.mock.method(User, "findOne", (filter) => ({
    select: async () => account.email === filter.email ? account : null,
  }));
  const request = await startApi(t);

  const registration = await request("/auth/register", { body: credentials });
  assert.equal(registration.status, 201);
  assert.deepEqual(await registration.json(), { message: "Registration successful" });
  assert.equal(account.role, "user");
  assert.equal(account.emailVerified, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "fan@example.test");
  const link = new URL(sent[0].text.match(/https:\/\/\S+/)[0]);
  assert.equal(link.origin, "https://pizza.example.test");
  assert.equal(link.pathname, "/verify-email");
  const verificationToken = new URLSearchParams(link.hash.slice(1)).get("token");
  assert.equal(account.emailVerificationTokenHash, createHash("sha256").update(verificationToken).digest("hex"));

  const login = await request("/auth/login", { body: credentials });
  assert.equal(login.status, 200);
  const { token, user } = await login.json();
  assert.equal(user.emailVerified, false);
  assert.equal((await request("/orders", { body: {} })).status, 401);
  assert.equal((await request("/orders", { body: {}, token })).status, 403);
  assert.equal((await request("/admin/inventory")).status, 401);
  assert.equal((await request("/admin/inventory", { token })).status, 403);
  assert.equal((await request("/auth/register", { body: credentials })).status, 409);
  assert.equal(sent.length, 1);

  const expiry = account.emailVerificationExpires;
  account.emailVerificationExpires = new Date(Date.now() - 1000);
  const verify = () => request("/auth/verify-email", { body: { token: verificationToken } });
  assert.equal((await verify()).status, 400);
  account.emailVerificationExpires = expiry;
  const attempts = await Promise.all([verify(), verify()]);
  assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [200, 400]);
  assert.equal(account.emailVerificationTokenHash, undefined);
  assert.equal(account.emailVerificationExpires, undefined);
  assert.equal((await request("/orders", { body: {}, token })).status, 400);
});

test("an account can request a new verification link after delivery fails", async (t) => {
  setEnvironment(t, { NODE_ENV: "production", SMTP_HOST: "smtp.example.test", EMAIL_FROM: "pizza@example.test" });
  let account;
  let smtpAvailable = false;
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => {
      if (!smtpAvailable) throw new Error("SMTP unavailable");
    },
  }));
  t.mock.method(User, "create", async (fields) => {
    account = new User(fields);
    return account;
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, account.id);
    if (account.emailVerified !== filter.emailVerified) return null;
    account.set(update.$set);
    return account;
  });
  const request = await startApi(t);
  const registration = await request("/auth/register", { body: credentials });
  assert.equal(registration.status, 201);
  assert.equal((await registration.json()).verificationDeliveryFailed, true);
  const oldHash = account.emailVerificationTokenHash;

  smtpAvailable = true;
  const token = jwt.sign({ id: account.id, role: account.role }, process.env.JWT_SECRET || "development-secret");
  assert.equal((await request("/auth/resend-verification", { body: {} })).status, 401);
  assert.equal((await request("/auth/resend-verification", { body: {}, token })).status, 200);
  assert.notEqual(account.emailVerificationTokenHash, oldHash);
});

test("only development exposes a verification link when SMTP is absent", async (t) => {
  setEnvironment(t, { NODE_ENV: "production", SMTP_HOST: undefined, CLIENT_URL: "http://localhost:5173" });
  const create = t.mock.method(User, "create", async (fields) => new User(fields));
  const transport = t.mock.method(nodemailer, "createTransport", () => {
    throw new Error("Unexpected SMTP connection");
  });
  const request = await startApi(t);

  assert.equal((await request("/auth/register", { body: credentials })).status, 503);
  assert.equal(create.mock.callCount(), 0);

  process.env.NODE_ENV = "development";
  const registration = await request("/auth/register", { body: credentials });
  assert.equal(registration.status, 201);
  const { verificationToken, verificationUrl } = await registration.json();
  assert.equal(verificationUrl, `http://localhost:5173/verify-email#token=${verificationToken}`);
  assert.match(verificationToken, /^[a-f0-9]{64}$/);
  assert.equal(transport.mock.callCount(), 0);
});
