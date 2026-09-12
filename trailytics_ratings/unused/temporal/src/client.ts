/** Temporal client factory (used by schedule.ts and any one-shot tooling). */
import { Connection, Client } from '@temporalio/client';
import { TEMPORAL_ADDRESS, NAMESPACE } from './config';

export async function buildClient(): Promise<Client> {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  return new Client({ connection, namespace: NAMESPACE });
}
