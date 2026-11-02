import type { MinorUnit } from './money';

/**
 * Active ISO 4217 currencies a family can choose, with their minor units (fund codes and metals left out).
 * The minor unit comes from this table, never from Intl. Display names come from Intl.DisplayNames in the UI.
 */
const CODES =
  'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY ' +
  'COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ' +
  'ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK ' +
  'MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF ' +
  'SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU ' +
  'UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG';

const ZERO = new Set('BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF'.split(' '));
const THREE = new Set('BHD IQD JOD KWD LYD OMR TND'.split(' '));

export const CURRENCIES: ReadonlyMap<string, MinorUnit> = new Map(
  CODES.split(' ').map((code) => [code, ZERO.has(code) ? 0 : THREE.has(code) ? 3 : 2] as const),
);

/** The minor unit of an active currency, or undefined if the code is not one. */
export function minorUnitOf(currencyCode: string): MinorUnit | undefined {
  return CURRENCIES.get(currencyCode);
}
