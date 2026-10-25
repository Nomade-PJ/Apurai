import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/security/password";
import { createSessionToken, verifySessionToken } from "../lib/security/session";
import { rateLimit, resetRateLimits } from "../lib/security/rate-limit";
import { isSameOrigin } from "../lib/security/origin";

const SECRET = "s".repeat(40);

test("senha: hash não contém texto puro; verificação correta e incorreta", () => {
  const h = hashPassword("senha-bem-forte-123");
  assert.ok(!h.includes("senha-bem-forte-123"));
  assert.equal(verifyPassword("senha-bem-forte-123", h), true);
  assert.equal(verifyPassword("outra-senha", h), false);
  assert.equal(verifyPassword("x", "formato-invalido"), false);
  assert.equal(verifyPassword("x", ""), false);
});

test("sessão: token válido, adulterado, expirado e segredo curto", () => {
  const t = createSessionToken(SECRET, 1_000_000_000, 60);
  assert.equal(verifySessionToken(t, SECRET, 1_000_000_000 + 30_000), true);
  assert.equal(verifySessionToken(t, SECRET, 1_000_000_000 + 61_000), false);
  assert.equal(verifySessionToken(t + "x", SECRET, 1_000_000_000), false);
  assert.equal(verifySessionToken(t, "outro-segredo-" + "z".repeat(30), 1_000_000_000), false);
  assert.equal(verifySessionToken(undefined, SECRET), false);
  assert.equal(verifySessionToken(t, "curto"), false);
});

test("rate limit bloqueia após o limite e libera depois da janela", () => {
  resetRateLimits();
  assert.equal(rateLimit("k", 2, 1000, 0), true);
  assert.equal(rateLimit("k", 2, 1000, 1), true);
  assert.equal(rateLimit("k", 2, 1000, 2), false);
  assert.equal(rateLimit("k", 2, 1000, 1500), true);
  assert.equal(rateLimit("outra", 2, 1000, 2), true);
});

test("origem: aceita same-origin; rejeita ausente/estrangeira", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(isSameOrigin(h({ origin: "https://apurai.com.br", host: "apurai.com.br" })), true);
  assert.equal(isSameOrigin(h({ origin: "https://evil.com", host: "apurai.com.br" })), false);
  assert.equal(isSameOrigin(h({ host: "apurai.com.br" })), false);
  assert.equal(isSameOrigin(h({ origin: "nao-e-url", host: "apurai.com.br" })), false);
});
