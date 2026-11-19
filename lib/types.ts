export type QuotationStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'CANCELLED' | 'EXPIRED';

export interface SessionUserLike {
  id: string;
  role: 'ADMIN' | 'SALES';
}
