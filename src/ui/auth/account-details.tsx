import { texts } from "./texts";

type Account = { name: string; email: string; emailVerified: boolean };

// What the account's page shows of the account: the name, the e-mail and
// whether it is confirmed.
export function AccountDetails({ account }: { account: Account }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      <dt className="font-semibold">{texts.account.name}</dt>
      <dd>{account.name}</dd>
      <dt className="font-semibold">{texts.account.email}</dt>
      <dd>{account.email}</dd>
      <dt className="font-semibold">{texts.account.verification}</dt>
      <dd>
        {account.emailVerified
          ? texts.account.verified
          : texts.account.notVerified}
      </dd>
    </dl>
  );
}
