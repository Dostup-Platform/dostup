import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorKeyFromUnknown, classifyAuthError } from "./authErrors.ts";

test("already-registered send errors are not the Google toast", () => {
  assert.equal(classifyAuthError({ message: "User already registered" }), "email_send_failed");
  assert.equal(
    classifyAuthError({ message: "A user with this email address has already been registered" }),
    "email_send_failed",
  );
  assert.equal(classifyAuthError({ message: "email already exists" }), "email_send_failed");
  assert.equal(
    classifyAuthError({ message: "Error sending magic link email" }),
    "email_send_failed",
  );
  assert.equal(
    classifyAuthError({ message: "Edge Function returned a non-2xx status code" }),
    "email_send_failed",
  );
  assert.equal(authErrorKeyFromUnknown({ message: "User already registered" }), "emailSendFailed");
});

test("double-classified send errors still map to emailSendFailed", () => {
  const first = classifyAuthError({ message: "Failed to send code" });
  assert.equal(first, "email_send_failed");
  assert.equal(
    authErrorKeyFromUnknown({ message: "Failed to send code", code: first }),
    "emailSendFailed",
  );
});

test("gotrue wait-a-minute send errors are rate limits", () => {
  assert.equal(
    classifyAuthError({
      message: "For security purposes, you can only request this after 59 seconds.",
      status: 429,
    }),
    "email_rate_limited",
  );
  assert.equal(
    authErrorKeyFromUnknown({
      message: "For security purposes, you can only request this after 59 seconds.",
    }),
    "emailRateLimited",
  );
});

test("exchange failure is a login retry, not Google", () => {
  assert.equal(classifyAuthError({ message: "exchange_failed", code: "exchange_failed" }), "login_failed");
  assert.equal(authErrorKeyFromUnknown({ message: "exchange_failed" }), "loginFailed");
});
