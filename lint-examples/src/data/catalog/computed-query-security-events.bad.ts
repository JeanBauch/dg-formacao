declare const db: {
  query: { securityEvents: { findMany(): Promise<unknown[]> } };
};

// The table's relational query as a computed member.
export const reads = db.query["securityEvents"].findMany();
