/**
 * Utility functions for formatting CPF, Phone/WhatsApp, and CEP masks in UI components.
 */

export const formatCpf = (val: string | number | undefined | null): string => {
  if (!val) return '';
  const nums = String(val).replace(/\D/g, '').slice(0, 11);
  if (nums.length === 0) return '';
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
};

export const formatPhone = (val: string | number | undefined | null): string => {
  if (!val) return '';
  const nums = String(val).replace(/\D/g, '').slice(0, 11);
  if (nums.length === 0) return '';
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
};

export const formatCep = (val: string | number | undefined | null): string => {
  if (!val) return '';
  const nums = String(val).replace(/\D/g, '').slice(0, 8);
  if (nums.length === 0) return '';
  if (nums.length <= 5) return nums;
  return `${nums.slice(0, 5)}-${nums.slice(5)}`;
};
