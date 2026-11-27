const ATM = /\b(atm|cash)\b.*\b(withdraw\w*|wdl)\b|\b(withdrawn|withdrawal|wdl)\b.*\b(atm|cash)\b|^(atw|nwd|eaw)\b/i;
const CARD_BILL = /\b(credit ?card|cc) ?(bill|payment|repayment|dues)\b|\bpayment\b.{0,60}\breceived\b.{0,60}\bcredit card\b/i;

export const isAtmWithdrawal = (text: string): boolean => ATM.test(text);
export const isCardBill = (text: string): boolean => CARD_BILL.test(text);
/** Money moving between your own pockets: not spending, so it is never counted twice. */
export const isOwnTransfer = (text: string): boolean =>
  isAtmWithdrawal(text) || isCardBill(text) || /\bself\b|\bown account\b/i.test(text);
