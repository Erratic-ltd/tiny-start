// Tiny Start maths answer checker.
// Reads typed answers like "c1*e^(2*x)+c2*e^(3*x)", shows how they were read (as LaTeX for KaTeX),
// and decides whether two answers are equivalent. Arbitrary constants (c, or c1, c2, ...) are
// treated as free: c*e^x and 5*c*e^x describe the same family of answers.
(function (root) {
  "use strict";

  function MathError(message) {
    this.message = message;
  }

  var FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    sec: function (x) { return 1 / Math.cos(x); },
    csc: function (x) { return 1 / Math.sin(x); },
    cot: function (x) { return 1 / Math.tan(x); },
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, exp: Math.exp
  };

  var FUNC_TEX = {
    sin: "\\sin", cos: "\\cos", tan: "\\tan", sec: "\\sec", csc: "\\csc", cot: "\\cot",
    asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan",
    sinh: "\\sinh", cosh: "\\cosh", tanh: "\\tanh", ln: "\\ln", exp: "\\exp"
  };

  var RENAMED = {
    log: "For the natural log, use ln(x).",
    arcsin: "Use asin(x).",
    arccos: "Use acos(x).",
    arctan: "Use atan(x).",
    sqr: "Use sqrt(x)."
  };

  var MAX_CONSTS = 6;

  // ---------- reading what was typed ----------

  function normalizeInput(text) {
    return String(text)
      .toLowerCase()
      .replace(/[−–—]/g, "-")
      .replace(/[×·]/g, "*")
      .replace(/÷/g, "/");
  }

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    while (i < src.length) {
      var ch = src.charAt(i);
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      var rest = src.slice(i);
      var m = /^(\d+\.?\d*|\.\d+)/.exec(rest);
      if (m) {
        tokens.push({ t: "num", v: parseFloat(m[1]), text: m[1] });
        i += m[1].length;
        continue;
      }
      m = /^[a-z][a-z0-9]*/.exec(rest);
      if (m) {
        tokens.push({ t: "id", text: m[0] });
        i += m[0].length;
        continue;
      }
      if ("+-*/^()".indexOf(ch) !== -1) {
        tokens.push({ t: "op", text: ch });
        i++;
        continue;
      }
      if (ch === ",") {
        throw new MathError("Commas aren't used in answers.");
      }
      throw new MathError('I don\'t understand the symbol "' + ch + '".');
    }
    return tokens;
  }

  function parseSide(src, allowedVars, info) {
    var tokens = tokenize(src);
    var pos = 0;

    if (tokens.length === 0) {
      throw new MathError("Something is missing next to the = sign.");
    }

    function isOp(tok, ch) {
      return !!tok && tok.t === "op" && tok.text === ch;
    }

    function expectClose() {
      if (!isOp(tokens[pos], ")")) {
        throw new MathError('There is a "(" that is never closed. Add a ")".');
      }
      pos++;
    }

    function parseExpr() {
      var left = parseTerm();
      for (;;) {
        var t = tokens[pos];
        if (isOp(t, "+") || isOp(t, "-")) {
          pos++;
          var right = parseTerm();
          left = { k: "bin", op: t.text, a: left, b: right };
        } else {
          break;
        }
      }
      return left;
    }

    function parseTerm() {
      var left = parseUnary();
      for (;;) {
        var t = tokens[pos];
        if (isOp(t, "*") || isOp(t, "/")) {
          pos++;
          var right = parseUnary();
          left = { k: "bin", op: t.text, a: left, b: right };
          continue;
        }
        if (t && (t.t === "num" || t.t === "id" || isOp(t, "("))) {
          throw new MathError('Put a * between "' + tokens[pos - 1].text + '" and "' + t.text + '".');
        }
        break;
      }
      return left;
    }

    function parseUnary() {
      var t = tokens[pos];
      if (isOp(t, "-")) {
        pos++;
        return { k: "neg", a: parseUnary() };
      }
      if (isOp(t, "+")) {
        pos++;
        return parseUnary();
      }
      return parsePower();
    }

    function parsePower() {
      var base = parseAtom();
      if (isOp(tokens[pos], "^")) {
        pos++;
        var exponent = parseUnary();
        return { k: "bin", op: "^", a: base, b: exponent };
      }
      return base;
    }

    function parseAtom() {
      var tok = tokens[pos];
      if (!tok) {
        throw new MathError("The answer looks unfinished. Is something missing at the end?");
      }
      if (tok.t === "num") {
        pos++;
        return { k: "num", v: tok.v, text: tok.text };
      }
      if (tok.t === "op") {
        if (tok.text === "(") {
          pos++;
          var inner = parseExpr();
          expectClose();
          return inner;
        }
        throw new MathError('Something is missing before "' + tok.text + '".');
      }

      var name = tok.text;
      pos++;
      var next = tokens[pos];

      if (FUNCS.hasOwnProperty(name)) {
        if (!isOp(next, "(")) {
          throw new MathError(name + " needs brackets, like " + name + "(x).");
        }
        pos++;
        var arg = parseExpr();
        expectClose();
        return { k: "fn", n: name, a: arg };
      }
      if (name === "e") {
        return { k: "e" };
      }
      if (name === "pi") {
        return { k: "pi" };
      }
      if (/^c\d*$/.test(name)) {
        if (name === "c0") {
          throw new MathError("Constants are c, or c1, c2, c3 ... (starting at 1).");
        }
        info.consts[name] = true;
        return { k: "const", n: name };
      }
      if (RENAMED.hasOwnProperty(name)) {
        throw new MathError('I don\'t know "' + name + '". ' + RENAMED[name]);
      }

      var isVar = allowedVars ? allowedVars.indexOf(name) !== -1 : name.length === 1;
      if (isVar) {
        info.vars[name] = true;
        return { k: "var", n: name };
      }
      if (name.length === 1 && allowedVars) {
        throw new MathError(
          '"' + name + '" isn\'t used in this question. ' +
          (allowedVars.length ? "Use: " + allowedVars.join(", ") + "." : "This answer has no letters in it, only numbers.")
        );
      }
      throw new MathError('I don\'t know "' + name + '". To multiply letters, use *, like x*y.');
    }

    var node = parseExpr();
    if (pos < tokens.length) {
      var t = tokens[pos];
      if (isOp(t, ")")) {
        throw new MathError('There is an extra ")". Check your brackets.');
      }
      throw new MathError('I didn\'t expect "' + t.text + '" here.');
    }
    return node;
  }

  function validateConstNames(names) {
    if (names.length === 0) {
      return;
    }
    if (names.length > MAX_CONSTS) {
      throw new MathError("That's more constants than I expect (c1 to c" + MAX_CONSTS + " at most).");
    }
    if (names.indexOf("c") !== -1) {
      if (names.length > 1) {
        throw new MathError("Use either c (for one constant) or c1, c2, ... (for several), not both.");
      }
      return;
    }
    var nums = names
      .map(function (n) { return parseInt(n.slice(1), 10); })
      .sort(function (a, b) { return a - b; });
    for (var i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        throw new MathError("When there are several constants, number them in order: c1, c2, c3 ...");
      }
    }
  }

  // ---------- showing how it was read (LaTeX) ----------

  function wrap(r, minPrec) {
    return r.p < minPrec ? "\\left(" + r.s + "\\right)" : r.s;
  }

  // Precedence: add 2, neg 5, mul 4, frac 6, pow 7, atom 9.
  function tex(n) {
    switch (n.k) {
      case "num":
        return { s: n.text, p: 9 };
      case "var":
        return { s: n.n, p: 9 };
      case "const":
        return { s: n.n.length > 1 ? "c_{" + n.n.slice(1) + "}" : "c", p: 9 };
      case "e":
        return { s: "e", p: 9 };
      case "pi":
        return { s: "\\pi", p: 9 };
      case "neg": {
        var inner = tex(n.a);
        return { s: "-" + wrap(inner, 5), p: 5 };
      }
      case "fn": {
        var arg = tex(n.a).s;
        if (n.n === "sqrt") {
          return { s: "\\sqrt{" + arg + "}", p: 9 };
        }
        if (n.n === "abs") {
          return { s: "\\left|" + arg + "\\right|", p: 9 };
        }
        return { s: FUNC_TEX[n.n] + "\\left(" + arg + "\\right)", p: 9 };
      }
      case "bin": {
        var a = tex(n.a);
        var b = tex(n.b);
        if (n.op === "+") {
          if (n.b.k === "neg") {
            return { s: a.s + "-" + wrap(tex(n.b.a), 5), p: 2 };
          }
          return { s: a.s + "+" + b.s, p: 2 };
        }
        if (n.op === "-") {
          return { s: a.s + "-" + wrap(b, 3), p: 2 };
        }
        if (n.op === "*") {
          var ls = wrap(a, 4);
          var rs = wrap(b, 6);
          var sep = "";
          var leftIsFraction = n.a.k === "bin" && n.a.op === "/";
          if (leftIsFraction || /^[0-9.]/.test(rs)) {
            sep = "\\cdot ";
          }
          return { s: ls + sep + rs, p: 4 };
        }
        if (n.op === "/") {
          return { s: "\\frac{" + a.s + "}{" + b.s + "}", p: 6 };
        }
        // power
        return { s: wrap(a, 8) + "^{" + b.s + "}", p: 7 };
      }
    }
    return { s: "?", p: 9 };
  }

  // ---------- public parse ----------

  function parseAnswer(text, allowedVars) {
    var src = normalizeInput(text);
    if (src.trim() === "") {
      return { ok: false, empty: true, error: "Type your answer above." };
    }
    try {
      var parts = src.split("=");
      if (parts.length > 2) {
        throw new MathError("There is more than one = sign.");
      }
      var info = { vars: {}, consts: {} };
      var sides = parts.map(function (part) {
        return parseSide(part, allowedVars, info);
      });
      var constList = Object.keys(info.consts).sort();
      validateConstNames(constList);
      var latex = sides.map(function (s) { return tex(s).s; }).join("=");
      return {
        ok: true,
        hasEq: sides.length === 2,
        sides: sides,
        vars: Object.keys(info.vars).sort(),
        consts: constList,
        latex: latex
      };
    } catch (e) {
      if (e instanceof MathError) {
        return { ok: false, error: e.message };
      }
      throw e;
    }
  }

  // ---------- checking two answers ----------

  function evalNode(n, env) {
    switch (n.k) {
      case "num": return n.v;
      case "var": return env.vars[n.n];
      case "const": return env.consts[n.n];
      case "e": return Math.E;
      case "pi": return Math.PI;
      case "neg": return -evalNode(n.a, env);
      case "fn": return FUNCS[n.n](evalNode(n.a, env));
      case "bin": {
        var a = evalNode(n.a, env);
        var b = evalNode(n.b, env);
        if (n.op === "+") { return a + b; }
        if (n.op === "-") { return a - b; }
        if (n.op === "*") { return a * b; }
        if (n.op === "/") { return a / b; }
        return Math.pow(a, b);
      }
    }
    return NaN;
  }

  // Same sample points every time, so an answer is always marked the same way.
  function makeRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomValue(rand) {
    var r = rand();
    if (r < 0.4) { return 0.2 + rand() * 2.0; }
    if (r < 0.65) { return -(0.2 + rand() * 2.0); }
    return -0.95 + rand() * 1.9;
  }

  function isGood(x) {
    return isFinite(x) && Math.abs(x) < 1e6;
  }

  function dot(u, v) {
    var s = 0;
    for (var i = 0; i < u.length; i++) { s += u[i] * v[i]; }
    return s;
  }

  function norm(u) {
    return Math.sqrt(dot(u, u));
  }

  function removeParts(v, basis) {
    var w = v.slice();
    for (var pass = 0; pass < 2; pass++) {
      for (var b = 0; b < basis.length; b++) {
        var d = dot(w, basis[b]);
        for (var i = 0; i < w.length; i++) { w[i] -= d * basis[b][i]; }
      }
    }
    return w;
  }

  function makeBasis(vectors) {
    var basis = [];
    vectors.forEach(function (v) {
      var w = removeParts(v, basis);
      var n = norm(w);
      if (n > 1e-8 * Math.max(1, norm(v))) {
        basis.push(w.map(function (x) { return x / n; }));
      }
    });
    return basis;
  }

  function residual(v, basis) {
    return norm(removeParts(v, basis));
  }

  function zeros(k) {
    var env = {};
    for (var i = 0; i < k; i++) { env[i] = 0; }
    return env;
  }

  function constEnv(names, values) {
    var env = {};
    names.forEach(function (n, i) { env[n] = values[i]; });
    return env;
  }

  var PROBE = [0.7, -1.3, 0.9, 1.7, -0.6, 1.1];

  // Collect sample points where everything we need is a sensible number.
  function collectPoints(varNames, evaluate, wanted) {
    var rand = makeRandom(20260428);
    var points = [];
    for (var attempt = 0; attempt < 800 && points.length < wanted; attempt++) {
      var vars = {};
      varNames.forEach(function (v) { vars[v] = randomValue(rand); });
      var result = evaluate(vars);
      if (result) {
        points.push({ vars: vars, data: result });
      }
    }
    return points;
  }

  function sameFamily(refNode, gotNode, names, varNames) {
    var k = names.length;
    var unit = [];
    for (var i = 0; i < k; i++) {
      var u = [];
      for (var j = 0; j < k; j++) { u.push(i === j ? 1 : 0); }
      unit.push(u);
    }
    var zero = zeros(k);
    var base = [];
    for (var z = 0; z < k; z++) { base.push(0); }

    function family(node, vars) {
      var f0 = evalNode(node, { vars: vars, consts: constEnv(names, base) });
      var gs = unit.map(function (u2) {
        return evalNode(node, { vars: vars, consts: constEnv(names, u2) }) - f0;
      });
      var probeVals = PROBE.slice(0, k);
      var actual = evalNode(node, { vars: vars, consts: constEnv(names, probeVals) });
      var predicted = f0;
      for (var q = 0; q < k; q++) { predicted += probeVals[q] * gs[q]; }
      return { f0: f0, gs: gs, actual: actual, predicted: predicted };
    }

    var points = collectPoints(varNames, function (vars) {
      var r = family(refNode, vars);
      var g = family(gotNode, vars);
      var all = [r.f0, r.actual, r.predicted, g.f0, g.actual, g.predicted].concat(r.gs, g.gs);
      for (var q = 0; q < all.length; q++) {
        if (!isGood(all[q])) { return null; }
      }
      return { r: r, g: g };
    }, 14);

    if (points.length < 6) {
      return false;
    }

    var affine = points.every(function (p) {
      return [p.data.r, p.data.g].every(function (d) {
        return Math.abs(d.actual - d.predicted) <= 1e-6 * (1 + Math.abs(d.actual));
      });
    });

    if (!affine) {
      // Constants appear in a non-linear way (for example e^c). Compare with the same values plugged in.
      return points.every(function (p) {
        var a = evalNode(refNode, { vars: p.vars, consts: constEnv(names, PROBE.slice(0, k)) });
        var b = evalNode(gotNode, { vars: p.vars, consts: constEnv(names, PROBE.slice(0, k)) });
        return Math.abs(a - b) <= 1e-7 * (1 + Math.abs(a) + Math.abs(b));
      });
    }

    var refG0 = points.map(function (p) { return p.data.r.f0; });
    var gotG0 = points.map(function (p) { return p.data.g.f0; });
    var refGs = [];
    var gotGs = [];
    for (var c = 0; c < k; c++) {
      refGs.push(points.map(function (p) { return p.data.r.gs[c]; }));
      gotGs.push(points.map(function (p) { return p.data.g.gs[c]; }));
    }

    var refBasis = makeBasis(refGs);
    var gotBasis = makeBasis(gotGs);
    if (refBasis.length !== gotBasis.length) {
      return false;
    }
    for (var m = 0; m < gotGs.length; m++) {
      if (residual(gotGs[m], refBasis) > 1e-6 * (1 + norm(gotGs[m]))) {
        return false;
      }
    }
    var diff = refG0.map(function (x, idx) { return gotG0[idx] - x; });
    return residual(diff, refBasis) <= 1e-6 * (1 + norm(diff) + norm(refG0));
  }

  function sameUpToFactor(refNode, gotNode, names, varNames) {
    var vals = PROBE.slice(0, names.length);
    var points = collectPoints(varNames, function (vars) {
      var env = { vars: vars, consts: constEnv(names, vals) };
      var a = evalNode(refNode, env);
      var b = evalNode(gotNode, env);
      return isGood(a) && isGood(b) ? { a: a, b: b } : null;
    }, 14);
    if (points.length < 6) {
      return false;
    }
    var factor = null;
    for (var i = 0; i < points.length; i++) {
      if (Math.abs(points[i].data.a) > 1e-6) {
        factor = points[i].data.b / points[i].data.a;
        break;
      }
    }
    if (factor === null || Math.abs(factor) < 1e-9) {
      return false;
    }
    return points.every(function (p) {
      var a = p.data.a;
      var b = p.data.b;
      return Math.abs(b - factor * a) <= 1e-6 * (1 + Math.abs(b) + Math.abs(factor * a));
    });
  }

  function union(a, b) {
    var out = a.slice();
    b.forEach(function (x) {
      if (out.indexOf(x) === -1) { out.push(x); }
    });
    return out.sort();
  }

  function check(ref, got) {
    if (!ref || !got || !ref.ok || !got.ok) {
      return false;
    }
    if (ref.hasEq !== got.hasEq) {
      return false;
    }
    if (ref.consts.join(",") !== got.consts.join(",")) {
      return false;
    }
    var names = ref.consts;
    var varNames = union(ref.vars, got.vars);

    if (!ref.hasEq) {
      return sameFamily(ref.sides[0], got.sides[0], names, varNames);
    }

    var rl = ref.sides[0];
    var gl = got.sides[0];
    if (rl.k === "var" && gl.k === "var" && rl.n === gl.n) {
      return sameFamily(ref.sides[1], got.sides[1], names, varNames);
    }

    var refDiff = { k: "bin", op: "-", a: ref.sides[0], b: ref.sides[1] };
    var gotDiff = { k: "bin", op: "-", a: got.sides[0], b: got.sides[1] };
    return sameUpToFactor(refDiff, gotDiff, names, varNames);
  }

  var api = {
    parseAnswer: parseAnswer,
    check: check,
    normalizeInput: normalizeInput
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TinyMath = api;
  }
})(typeof window !== "undefined" ? window : this);
