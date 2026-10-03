export function buildUpiPaymentUri({
  payeeVpa,
  payeeName,
  amountPaise,
  requestId,
}: {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  requestId: string;
}) {
  const vpa = payeeVpa.trim();
  if (!vpa) throw new Error("Set UPI_VPA to enable UPI QR payments.");
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("Payment amount must be a positive integer in paise.");
  }

  const reference = `RF-${requestId.slice(-12)}`;
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName.trim() || "ReviewFlow",
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `ReviewFlow QR request ${reference}`,
    tr: reference,
  });

  return `upi://pay?${params.toString()}`;
}
