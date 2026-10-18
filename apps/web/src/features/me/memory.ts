export interface Memory {
  id: string;
  type: string;
  status: "pending" | "stored" | "failed";
  channel: string;
  createdAt: string;
  blobId: string | null;
  expiresAt: string | null;
  ciphertextUrl: string | null;
  explorerUrl: string | null;
  hidden?: boolean;
  accountId?: string;
  textSha256?: string;
}
