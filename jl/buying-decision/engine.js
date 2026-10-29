/* Trail Manual — JL buying decision engine.
 *
 * Pure functions, no DOM: the page and the Node regression tests run the same code.
 * Model (from the JL decision research): hard gates first, then a weighted score.
 * A score never compensates for a failed gate, unknown facts never pass a gate,
 * and every dollar is counted once (trade XOR private sale; parts you keep are
 * never also sold; build money can't go in a car loan).
 */
(function (root) {
  'use strict';

  var CRITERIA = [
    { id: 'rig',     label: 'Finished, capable rig at your tire size' },
    { id: 'cost',    label: 'Net cost to a finished rig' },
    { id: 'payment', label: 'Monthly payment' },
    { id: 'family',  label: 'Rear-seat safety and comfort' },
    { id: 'towing',  label: 'Towing headroom' },
    { id: 'hours',   label: 'Your wrench hours' },
    { id: 'exit',    label: 'Value if plans change' }
  ];

  var PRESETS = {
    balanced:   { label: 'Balanced',                   weights: { rig: 30, cost: 25, payment: 15, family: 15, towing: 5, hours: 5, exit: 5 } },
    cash_first: { label: 'Cash first, keep my build',  weights: { rig: 35, cost: 30, payment: 20, family: 5,  towing: 0, hours: 5, exit: 5 } },
    family:     { label: 'Family daily driver + towing', weights: { rig: 15, cost: 15, payment: 15, family: 35, towing: 15, hours: 0, exit: 5 } },
    trail:      { label: 'Trail-ready on a budget',    weights: { rig: 40, cost: 30, payment: 10, family: 5,  towing: 0, hours: 10, exit: 5 } }
  };

  var QUESTIONS = [
    { id: 'q_curtains',  weight: 2,   text: 'How much would rear-row curtain airbags ease your mind with passengers in back?', pulls: 'curtains' },
    { id: 'q_offcamber', weight: 1,   text: 'How much would a curtain airbag firing on an off-camber trail bother you?', pulls: 'no_curtains' },
    { id: 'q_heat',      weight: 1.5, text: 'Does back-seat heat change how often your passengers come along?', pulls: 'rear_vents' },
    { id: 'q_build',     weight: 1.5, text: 'What share of your trips need a full build, not a stock Rubicon on 33s?', pulls: 'rig' },
    { id: 'q_wrench',    weight: 1.5, text: 'How much do you want to do the build work yourself?', pulls: 'wrench' },
    { id: 'q_payment',   weight: 1,   text: 'How heavy would a five-year payment feel?', pulls: 'no_loan' },
    { id: 'q_history',   weight: 1,   text: 'How much would owning a 100k-mile Jeep with someone else’s history bother you?', pulls: 'newer' },
    { id: 'q_repair',    weight: 1,   text: 'How much would a surprise $2,000–3,000 repair in year one hurt?', pulls: 'newer' },
    { id: 'q_resale',    weight: 0.5, text: 'How much does the Jeep’s value in five years matter to you?', pulls: 'exit' },
    { id: 'q_tow',       weight: 1,   text: 'How likely are you to tow more than 3,500 lb in the next five years?', pulls: 'tow' }
  ];

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function clip(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v) { return Math.round(v); }

  /** Monthly payment on a fixed-rate loan; zero APR divides evenly. */
  function payment(principal, aprPct, months) {
    if (!(principal > 0) || !(months > 0)) return 0;
    var r = (aprPct || 0) / 100 / 12;
    if (r === 0) return principal / months;
    return principal * r / (1 - Math.pow(1 + r, -months));
  }

  function candidateFacts(ref, key) {
    var c = ref.candidates[key];
    var towClaim = ref.claims[c.tow_claim] || {};
    var ventsClaim = ref.claims[c.vents_claim] || {};
    return {
      key: key, c: c,
      towLb: num(c.tow_lb),
      towStatus: towClaim.status || 'verified',
      curtainRows: c.curtain_rows,
      rearVents: c.rear_vents === undefined ? null : c.rear_vents,
      ventsStatus: c.vents_claim ? (ventsClaim.status || 'verified') : 'unknown'
    };
  }

  /** Build lines for reaching the target tire size from this platform. */
  function buildLines(ref, key, inp) {
    var lines = [];
    var builtJk = inp.current === 'built_jk';
    var costs = ref.build_costs || {};
    Object.keys(costs).forEach(function (id) {
      var l = costs[id];
      if (l.applies.indexOf(key) < 0 || l.tires.indexOf(inp.tires) < 0) return;
      if (l.needs === 'jk_build' && !builtJk) return;
      if (l.needs === 'no_jk_build' && builtJk) return;
      var shopLabor = (inp.labor === 'shop' && !l.shop_only) ? (l.hours || 0) : 0;
      var rate = ref.labor || { shop_rate_low: 150, shop_rate_high: 180 };
      lines.push({
        id: id, label: l.label, claim: l.claim || null,
        low: l.low + shopLabor * rate.shop_rate_low,
        high: l.high + shopLabor * rate.shop_rate_high,
        diyHours: (inp.labor === 'diy' && !l.shop_only) ? (l.hours || 0) : 0,
        laborIncluded: shopLabor > 0 || !!l.shop_only
      });
    });
    lines.forEach(function (l) { l.base = (l.low + l.high) / 2; });
    return lines;
  }

  /** Parts proceeds that genuinely exist on this path (never parts you keep). */
  function partsProceeds(key, inp) {
    var p = inp.parts || {};
    if (inp.current !== 'built_jk') return { total: 0, items: [] };
    var items = [];
    if (key === 'jk_late') {
      // The build moves to the new JK; only the donor's stock parts and the old shell are sold.
      if (num(p.donor_takeoffs)) items.push({ label: 'Donor JK stock parts (axles, case, wheels, bumpers)', amount: p.donor_takeoffs });
    } else {
      // Moving to a JL/JT: most of the JK build can't move, so it's sold.
      if (num(p.build_sale)) items.push({ label: 'JK build parts that don’t fit the new platform', amount: p.build_sale });
    }
    if (num(p.old_remainder)) items.push({ label: 'Old Jeep’s remaining shell/parts', amount: p.old_remainder });
    var total = items.reduce(function (s, i) { return s + i.amount; }, 0);
    return { total: total, items: items };
  }

  function evaluateCandidate(ref, key, inp, opt) {
    var cin = (inp.candidates || {})[key] || {};
    var f = candidateFacts(ref, key);
    var price = num(cin.price);
    var seller = cin.seller === 'dealer' ? 'dealer' : 'private';
    var m = inp.money || {};
    var out = { key: key, name: f.c.name, short: f.c.short, gates: [], flags: [], facts: f.c.facts || [], price: price, seller: seller };

    if (price === null) { out.status = 'needs_price'; return out; }

    // ── Funding: one vehicle-sale mode, applied once ──
    var sellValue = num(m.sell_value) || 0;
    var sellMode = m.sell_mode || 'none';
    if (sellMode === 'trade' && seller !== 'dealer') {
      out.flags.push('A trade-in needs a dealer; on a private purchase your vehicle is counted as a private sale instead.');
      sellMode = 'private';
    }
    var tradeCredit = (sellMode === 'trade') ? sellValue : 0;
    var privateSale = (sellMode === 'private') ? sellValue : 0;
    var taxRate = (num(m.tax_rate) || 0) / 100;
    var taxable = seller === 'dealer' ? Math.max(0, price - tradeCredit) : (m.private_sale_taxed ? price : 0);
    var tax = taxable * taxRate;
    var fees = num(m.fees) || 0;
    var acquisition = price + tax + fees;

    var lines = buildLines(ref, key, inp);
    var build = { low: 0, base: 0, high: 0, diyHours: 0 };
    lines.forEach(function (l) { build.low += l.low; build.base += l.base; build.high += l.high; build.diyHours += l.diyHours; });
    var proceeds = partsProceeds(key, inp);

    // Parts proceeds fund the build first; leftover cash goes down on the Jeep.
    var cashPool = Math.max(0, (num(m.cash) || 0) - (num(m.reserve) || 0)) + privateSale;
    var buildFromCash = Math.max(0, build.base - proceeds.total);
    var cashForDown = Math.max(0, cashPool - buildFromCash);
    var financed = Math.max(0, acquisition - tradeCredit - cashForDown);
    var loanAllowed = m.loan !== 'no';
    var shortfall = Math.max(0, acquisition + build.base - tradeCredit - cashPool - proceeds.total);
    var monthly = loanAllowed ? payment(financed, num(m.apr) || 0, num(m.term) || 60) : 0;
    var interest = loanAllowed ? Math.max(0, monthly * (num(m.term) || 60) - financed) : 0;

    out.money = {
      price: price, tax: tax, taxable: taxable, fees: fees, acquisition: acquisition,
      tradeCredit: tradeCredit, privateSale: privateSale,
      build: build, buildLines: lines, proceeds: proceeds,
      netCost: acquisition + build.base - proceeds.total,
      netCostLow: acquisition + build.low - proceeds.total,
      netCostHigh: acquisition + build.high - proceeds.total,
      cashForDown: cashForDown, financed: loanAllowed ? financed : 0, monthly: monthly, interest: interest,
      shortfall: loanAllowed ? 0 : shortfall
    };

    // ── Gates: pass | marginal | fail | unknown ──
    function gate(id, label, result, why) { out.gates.push({ id: id, label: label, result: result, why: why }); }
    var trailer = num(inp.trailer_lb);
    if (trailer && trailer > 0) {
      if (f.towLb === null) gate('tow', 'Towing', 'unknown', 'No documented tow rating for this configuration.');
      else if (trailer > f.towLb) gate('tow', 'Towing', 'fail', 'Your ' + trailer.toLocaleString() + ' lb trailer is over the ' + f.towLb.toLocaleString() + ' lb rating.');
      else if (f.c.tow_as_built_tires && f.c.tow_as_built_tires.indexOf(inp.tires) < 0 && trailer > (num(f.c.tow_lb_floor) || 0))
        gate('tow', 'Towing', 'marginal', 'Rated ' + f.towLb.toLocaleString() + ' lb only as built on its factory gears and ' + f.c.tow_as_built_tires.join('/') + '-inch tires. ' +
          (num(f.c.tow_lb_floor) ? 'A factory 35-inch (4.56) configuration is rated ' + f.c.tow_lb_floor.toLocaleString() + ' lb, and ' : '') +
          'Jeep publishes no rating for a lifted, regeared build; armor and bigger tires eat payload and tongue-weight margin.');
      else if (f.towStatus === 'disputed' || f.towStatus === 'provisional') gate('tow', 'Towing', 'marginal', 'Rated ' + f.towLb.toLocaleString() + ' lb, but confirm the exact configuration in the owner documents before you tow.');
      else if (trailer > f.towLb * 0.9) gate('tow', 'Towing', 'marginal', 'Within 10% of the ' + f.towLb.toLocaleString() + ' lb rating; tongue weight and payload decide it.');
      else gate('tow', 'Towing', 'pass', 'Under the ' + f.towLb.toLocaleString() + ' lb rating.');
    }
    if (inp.curtains === 'required') {
      if (f.curtainRows >= 2) gate('curtains', 'Rear-row curtain airbags', 'pass', 'Front and second-row curtains standard.');
      else gate('curtains', 'Rear-row curtain airbags', 'fail', 'No rear-row curtain airbags, and they can’t be added.');
    }
    if (inp.rear_vents === 'required') {
      if (f.rearVents === null) gate('vents', 'Rear-seat air vents', 'unknown', 'Rear vents not confirmed for this model; check the vehicle.');
      else if (!f.rearVents) gate('vents', 'Rear-seat air vents', 'fail', 'No rear-seat vents.');
      else if (f.ventsStatus === 'verified') gate('vents', 'Rear-seat air vents', 'pass', 'Rear console vents.');
      else gate('vents', 'Rear-seat air vents', 'marginal', 'Owners report rear console vents on 4-door models, but no manufacturer document confirms them; check the vehicle.');
    }
    if (f.c.powertrain === '4xe') {
      var watch = (f.c.recall_watch || []).map(function (id) { return (ref.recalls || []).filter(function (r) { return r.id === id; })[0]; }).filter(Boolean);
      var open = watch.filter(function (r) { return r.remedy_status !== 'final'; });
      if (inp.phev === 'no') gate('phev', 'Plug-in hybrid', 'fail', 'You ruled out the 4xe.');
      else if (open.length && inp.phev === 'if_resolved') gate('phev', 'Plug-in hybrid', 'fail', open.length + ' 4xe campaign(s) without a confirmed final remedy and clean record: ' + open.map(function (r) { return r.id; }).join(', ') + '.');
      else if (open.length) gate('phev', 'Plug-in hybrid', 'marginal', 'Open questions on ' + open.map(function (r) { return r.id; }).join(', ') + '; check the VIN and remedy history.');
    }
    if (!loanAllowed && shortfall > 0) gate('cash', 'Cash', 'fail', 'Needs about $' + round(shortfall).toLocaleString() + ' more than your cash, sale and parts proceeds, with no loan.');
    var ceiling = num(m.payment_ceiling);
    if (loanAllowed && ceiling !== null && monthly > 0) {
      if (monthly > ceiling) gate('payment', 'Payment ceiling', 'fail', '$' + round(monthly) + '/mo is over your $' + round(ceiling) + ' ceiling.');
      else if (monthly > ceiling * 0.9) gate('payment', 'Payment ceiling', 'marginal', '$' + round(monthly) + '/mo is close to your $' + round(ceiling) + ' ceiling.');
      else gate('payment', 'Payment ceiling', 'pass', '$' + round(monthly) + '/mo.');
    }
    var results = out.gates.map(function (g) { return g.result; });
    out.status = results.indexOf('fail') >= 0 ? 'fail' : results.indexOf('unknown') >= 0 ? 'unknown' : results.indexOf('marginal') >= 0 ? 'marginal' : 'pass';
    out.buildDiyHours = build.diyHours;
    return out;
  }

  /** Criterion scores, 0–100, with the reason each number came from. */
  function scoreCandidates(ref, evals, inp) {
    var scored = evals.filter(function (e) { return e.status === 'pass' || e.status === 'marginal'; });
    var minCost = Math.min.apply(null, scored.map(function (e) { return Math.max(1, e.money.netCost); }));
    var builtJk = inp.current === 'built_jk';
    var trailer = num(inp.trailer_lb);
    var ceiling = num((inp.money || {}).payment_ceiling);
    scored.forEach(function (e) {
      var c = ref.candidates[e.key];
      var s = {}, why = {};
      // rig: end-state hardware at the target tires (Trail Manual judgment, reasons listed)
      var rig = 100, rigWhy = [];
      if (builtJk && e.key === 'jk_late') { rigWhy.push('your existing build moves over intact'); }
      else {
        if (c.rear_axle === 'semi_float' && inp.tires === 37) { rig -= 25; rigWhy.push('semi-float rear axle on 37s (documented shaft failures)'); }
        if (num(c.crawl) !== null && c.crawl < 65) { rig -= 15; rigWhy.push('lower stock crawl ratio (' + c.crawl + ':1)'); }
        if (c.platform === 'jt') { rig -= 20; rigWhy.push('about 19 in more wheelbase and less breakover/departure than a 4-door Wrangler'); }
        if (!rigWhy.length) rigWhy.push('full-float rear and low crawl ratio once built');
      }
      s.rig = clip(rig, 0, 100); why.rig = rigWhy.join('; ');
      s.cost = clip(100 * minCost / Math.max(1, e.money.netCost), 0, 100); why.cost = '$' + round(e.money.netCost).toLocaleString() + ' net (cheapest option = 100)';
      if (e.money.monthly <= 0) { s.payment = 100; why.payment = 'no loan needed'; }
      else if (ceiling) { s.payment = clip(100 * (1 - e.money.monthly / ceiling), 0, 100); why.payment = '$' + round(e.money.monthly) + '/mo against your $' + round(ceiling) + ' ceiling'; }
      else { s.payment = clip(100 - e.money.monthly / 10, 0, 100); why.payment = '$' + round(e.money.monthly) + '/mo'; }
      s.family = (c.curtain_rows >= 2 ? 60 : 0) + (c.rear_vents === true ? 40 : 0);
      why.family = (c.curtain_rows >= 2 ? 'rear-row curtain airbags' : 'no rear-row curtains') + ', ' +
        (c.rear_vents === true ? 'rear vents (owner-reported)' : c.rear_vents === false ? 'no rear vents' : 'rear vents not confirmed');
      if (trailer && trailer > 0 && num(c.tow_lb)) { s.towing = clip(200 * (c.tow_lb - trailer) / c.tow_lb, 0, 100); why.towing = (c.tow_lb - trailer).toLocaleString() + ' lb headroom'; }
      s.hours = clip(100 - 1.5 * (e.buildDiyHours || 0), 0, 100); why.hours = (e.buildDiyHours || 0) + ' DIY hours';
      s.exit = clip(100 * (c.exit_value_index || 0), 0, 100); why.exit = 'newer platforms hold value better (estimate)';
      e.scores = s; e.scoreWhy = why;
    });
    return scored;
  }

  /** Effective weights: towing drops out with no trailer, hours with shop labor. */
  function effectiveWeights(inp) {
    var w = {}, given = inp.weights || PRESETS.balanced.weights;
    CRITERIA.forEach(function (c) { w[c.id] = Math.max(0, num(given[c.id]) || 0); });
    if (!(num(inp.trailer_lb) > 0)) w.towing = 0;
    if (inp.labor === 'shop') w.hours = 0;
    return w;
  }

  function rank(scored, w) {
    var total = 0; Object.keys(w).forEach(function (k) { total += w[k]; });
    scored.forEach(function (e) {
      if (!total) { e.total = null; return; }
      var sum = 0; Object.keys(w).forEach(function (k) { sum += w[k] * (e.scores[k] || 0); });
      e.total = sum / total;
    });
    var ordered = scored.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); });
    return { ordered: ordered, winner: total && ordered.length ? ordered[0].key : null, close: !!(ordered[1] && ordered[0].total - ordered[1].total < 3) };
  }

  /** Questionnaire: distance from 3 × weight, credited to options it pulls toward. */
  function questionnaire(ref, evals, answers, inp) {
    if (!answers) return null;
    var any = Object.keys(answers).some(function (k) { return num(answers[k]) !== null; });
    if (!any) return null;
    var keys = evals.filter(function (e) { return e.status !== 'needs_price'; }).map(function (e) { return e.key; });
    var tally = {}; keys.forEach(function (k) { tally[k] = 0; });
    var rigLead = keys.slice().sort(function (a, b) { return ((evals.filter(function (e) { return e.key === b; })[0].scores || {}).rig || 0) - ((evals.filter(function (e) { return e.key === a; })[0].scores || {}).rig || 0); })[0];
    QUESTIONS.forEach(function (q) {
      var a = num(answers[q.id]); if (a === null) return;
      var d = (a - 3) * q.weight;
      keys.forEach(function (k) {
        var c = ref.candidates[k], e = evals.filter(function (x) { return x.key === k; })[0];
        var match;
        switch (q.pulls) {
          case 'curtains':    match = c.curtain_rows >= 2; break;
          case 'no_curtains': match = c.curtain_rows === 0; break;
          case 'rear_vents':  match = c.rear_vents === true; break;
          case 'rig':         match = (inp.current === 'built_jk' && k === 'jk_late') || k === rigLead; break;
          case 'wrench':      match = (e.buildDiyHours || 0) >= 20; break;
          case 'no_loan':     match = e.money && e.money.monthly <= 0; break;
          case 'newer':       match = c.platform !== 'jk'; break;
          case 'exit':        match = (c.exit_value_index || 0) >= 0.8; break;
          case 'tow':         match = (c.tow_lb || 0) > 3500; break;
        }
        tally[k] += match ? d : -d;
      });
    });
    var ordered = keys.slice().sort(function (a, b) { return tally[b] - tally[a]; });
    return { tally: tally, winner: ordered[0], ordered: ordered };
  }

  /** Run the whole model once. */
  function evaluate(ref, inp, opt) {
    var keys = Object.keys(ref.candidates).filter(function (k) {
      var cin = (inp.candidates || {})[k];
      return !cin || cin.include !== false;
    });
    var evals = keys.map(function (k) { return evaluateCandidate(ref, k, inp, opt); });
    var scored = scoreCandidates(ref, evals, inp);
    var w = effectiveWeights(inp);
    var r = rank(scored, w);
    return {
      evals: evals, ranked: r.ordered, winner: r.winner, close: r.close, weights: w,
      failed: evals.filter(function (e) { return e.status === 'fail' || e.status === 'unknown'; }),
      needsPrice: evals.filter(function (e) { return e.status === 'needs_price'; }),
      quiz: questionnaire(ref, evals, inp.answers, inp)
    };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** "What would change my answer?" — re-run with one input changed at a time. */
  function flips(ref, inp, base) {
    base = base || evaluate(ref, inp);
    var tries = [];
    function t(label, mutate) { var x = clone(inp); mutate(x); tries.push({ label: label, inp: x }); }
    if (inp.curtains === 'required') t('if rear-row curtain airbags were nice-to-have instead of required', function (x) { x.curtains = 'nice'; });
    else t('if rear-row curtain airbags were required', function (x) { x.curtains = 'required'; });
    if (num(inp.trailer_lb) > 0) t('with no trailer', function (x) { x.trailer_lb = null; });
    else t('with a 4,500 lb trailer', function (x) { x.trailer_lb = 4500; });
    t(inp.tires === 37 ? 'on 35-inch tires instead of 37s' : 'on 37-inch tires', function (x) { x.tires = inp.tires === 37 ? 35 : 37; });
    t(inp.labor === 'diy' ? 'if a shop did the work' : 'if you did the work yourself', function (x) { x.labor = inp.labor === 'diy' ? 'shop' : 'diy'; });
    if (num((inp.money || {}).payment_ceiling)) t('with a payment ceiling $100/mo higher', function (x) { x.money.payment_ceiling = inp.money.payment_ceiling + 100; });
    Object.keys(PRESETS).forEach(function (p) { t('with the “' + PRESETS[p].label + '” weights', function (x) { x.weights = clone(PRESETS[p].weights); }); });
    var out = [];
    tries.forEach(function (tr) {
      var r = evaluate(ref, tr.inp);
      if (r.winner !== base.winner) out.push({ label: tr.label, winner: r.winner, winnerName: r.winner ? ref.candidates[r.winner].name : null });
    });
    return out;
  }

  /** Default inputs for a new visitor (no personal data, planning-estimate prices). */
  function defaults(ref) {
    var cands = {};
    Object.keys(ref.candidates).forEach(function (k) {
      var p = ref.candidates[k].price || {};
      cands[k] = { include: true, price: num(p.base), seller: 'private' };
    });
    return {
      current: 'none', tires: 35, labor: 'diy', trailer_lb: null,
      curtains: 'nice', rear_vents: 'nice', phev: 'if_resolved',
      money: { cash: 10000, reserve: 3000, sell_value: 0, sell_mode: 'none', loan: 'yes',
               payment_ceiling: null, apr: 8, term: 60, tax_rate: 0, private_sale_taxed: false, fees: 400 },
      parts: { donor_takeoffs: 4000, build_sale: null, old_remainder: null },
      candidates: cands, weights: clone(PRESETS.balanced.weights), answers: {}
    };
  }

  var api = { CRITERIA: CRITERIA, PRESETS: PRESETS, QUESTIONS: QUESTIONS, payment: payment, evaluate: evaluate, flips: flips, defaults: defaults };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JLDecision = api;
})(this);
