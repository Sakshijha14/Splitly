const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** 123450 paise -> "₹1,234.50" */
export function formatMoney(paise: number): string {
  return rupees.format(paise / 100);
}
