import { texts } from "./texts";

type User = { name: string; email: string; emailVerified: boolean };

// What the user's page shows of the user: the name, the e-mail and whether it
// is confirmed.
export function UserDetails({ user }: { user: User }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      <dt className="font-semibold">{texts.user.name}</dt>
      <dd>{user.name}</dd>
      <dt className="font-semibold">{texts.user.email}</dt>
      <dd>{user.email}</dd>
      <dt className="font-semibold">{texts.user.verification}</dt>
      <dd>
        {user.emailVerified ? texts.user.verified : texts.user.notVerified}
      </dd>
    </dl>
  );
}
