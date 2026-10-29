import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function loadSupabaseClient(authSession) {
  const calls = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: authSession } }),
      signInAnonymously: async () => {
        calls.push("anonymous-sign-in");
        return { data: { user: { id: "new-user" } } };
      },
    },
  };
  const exports = {};
  const source = fs.readFileSync("lib/supabase.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      assert.equal(name, "@supabase/supabase-js");
      return {
        createClient: (...args) => {
          calls.push(args);
          return client;
        },
      };
    },
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      },
    },
  });
  return { exports, calls, client };
}

function findArrowFunction(sourceFile, name) {
  let result = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      if (ts.isArrowFunction(node.initializer)) result = node.initializer;
      else if (
        ts.isCallExpression(node.initializer) &&
        ts.isArrowFunction(node.initializer.arguments[0])
      )
        result = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

test("the browser Supabase client persists sessions and refreshes tokens", () => {
  const { exports, calls, client } = loadSupabaseClient(null);

  assert.equal(exports.supabase, client);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://example.test");
  assert.equal(calls[0][1], "public-test-key");
  assert.equal(calls[0][2].auth.persistSession, true);
  assert.equal(calls[0][2].auth.autoRefreshToken, true);
  assert.equal(calls[0][2].auth.detectSessionInUrl, true);
  assert.equal(calls[0][2].auth.storageKey, "zion-auth-session");
});

test("anonymous session helper reuses an existing session", async () => {
  const user = { id: "existing-user" };
  const { exports, calls } = loadSupabaseClient({ user });

  assert.equal(await exports.ensureAnonymousUser(), user);
  assert.equal(calls.filter((call) => call === "anonymous-sign-in").length, 0);
});

test("profile lookup failures keep the authenticated user and allow retry", () => {
  const source = fs.readFileSync("app/social-shell.tsx", "utf8");
  const sourceFile = ts.createSourceFile(
    "app/social-shell.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const loadProfile = findArrowFunction(sourceFile, "loadProfile");
  assert.ok(loadProfile);

  let profileLoadCatch = null;
  const findCatch = (node) => {
    if (ts.isCatchClause(node)) profileLoadCatch = node.block;
    ts.forEachChild(node, findCatch);
  };
  findCatch(loadProfile.body);
  assert.ok(profileLoadCatch);

  const calls = [];
  const findCalls = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
      calls.push(node);
    ts.forEachChild(node, findCalls);
  };
  findCalls(profileLoadCatch);
  assert.ok(calls.some((call) => call.expression.text === "setProfileLoadError"));
  assert.equal(
    calls.some(
      (call) =>
        call.expression.text === "setUser" &&
        call.arguments[0]?.kind === ts.SyntaxKind.NullKeyword,
    ),
    false,
  );
  assert.match(source, /if \(profileLoadError && user\)/);
  assert.match(source, /Retry profile loading/);
});
