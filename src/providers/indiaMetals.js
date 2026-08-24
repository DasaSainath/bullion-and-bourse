/**
 * There is no reliable free/keyless API for India's actual retail jeweller
 * quote. What we can do honestly is reconstruct it: global spot price,
 * converted through today's USD/INR rate, plus import duty and GST.
 *
 * This will land close to (not exactly on) real quoted rates — dealer
 * premiums and city-level differences make up the small remaining gap.
 * Duty/GST defaults below are illustrative for 2026 and worth checking
 * periodically (India's gold import duty in particular has changed more
 * than once this year) — see README.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;

function applyStack(usdPerOz, usdInr, importDutyPct, gstPct) {
  const usdPerGram = usdPerOz / GRAMS_PER_TROY_OZ;
  const inrPerGramBare = usdPerGram * usdInr;
  const afterDuty = inrPerGramBare * (1 + importDutyPct / 100);
  const afterGst = afterDuty * (1 + gstPct / 100);
  return { inrPerGramBare, afterDuty, afterGst };
}

function estimateIndiaGold({ spotUsdPerOz, usdInr, importDutyPct = 10, gstPct = 3 }) {
  const { inrPerGramBare, afterGst } = applyStack(spotUsdPerOz, usdInr, importDutyPct, gstPct);
  const PURITY_22K = 0.916;
  return {
    inrPerGram24k: afterGst,
    inrPer10g24k: afterGst * 10,
    inrPerGram22k: afterGst * PURITY_22K,
    inrPer10g22k: afterGst * 10 * PURITY_22K,
    breakdown: {
      inrPerGramBare,
      importDutyPct,
      gstPct
    }
  };
}

function estimateIndiaSilver({ spotUsdPerOz, usdInr, importDutyPct = 10, gstPct = 3 }) {
  const { inrPerGramBare, afterGst } = applyStack(spotUsdPerOz, usdInr, importDutyPct, gstPct);
  return {
    inrPerGram: afterGst,
    inrPer10g: afterGst * 10,
    inrPerKg: afterGst * 1000,
    breakdown: {
      inrPerGramBare,
      importDutyPct,
      gstPct
    }
  };
}

module.exports = { estimateIndiaGold, estimateIndiaSilver, GRAMS_PER_TROY_OZ };
