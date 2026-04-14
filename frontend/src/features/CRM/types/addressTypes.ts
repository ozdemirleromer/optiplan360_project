/**
 * CRM Address Types
 * Cari hesap adres tipleri ve form yapıları
 */

export type AddressType = "MERKEZ" | "FATURA" | "TESLIMAT";

export interface CRMAddress {
  id: string;
  accountId: string;
  addressTitle: string;
  addressLine: string;
  city: string;
  district: string;
  country: string;
  addressType?: AddressType;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  account_id: string;
  address_title: string;
  address_line: string;
  city: string;
  district: string;
  country: string;
  address_type?: AddressType;
  is_primary?: boolean;
}

export const ADDRESS_TYPE_OPTIONS = [
  { value: "MERKEZ", label: "Merkez" },
  { value: "FATURA", label: "Fatura" },
  { value: "TESLIMAT", label: "Teslimat" },
] as const;

export function describeAddressType(type?: AddressType): string {
  switch (type) {
    case "MERKEZ":
      return "Merkez";
    case "FATURA":
      return "Fatura";
    case "TESLIMAT":
      return "Teslimat";
    default:
      return "Belirtilmemiş";
  }
}
