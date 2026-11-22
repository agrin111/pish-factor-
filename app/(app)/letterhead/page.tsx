import { requireUser } from '@/lib/auth';
import { getCompanySettings, resolveLetterhead } from '@/lib/settings';
import { formatJalaliLong } from '@/lib/jalali';
import { LetterheadView } from '@/components/letterhead-view';

export const dynamic = 'force-dynamic';

export default async function LetterheadPage() {
  const user = await requireUser();
  const company = await getCompanySettings();

  const mainLetterhead = resolveLetterhead(company, 'MAIN');
  const miscLetterhead = resolveLetterhead(company, 'MISC');

  return (
    <LetterheadView
      mainLetterhead={mainLetterhead}
      miscLetterhead={miscLetterhead}
      todayLabel={formatJalaliLong(new Date())}
      isAdmin={user.role === 'ADMIN'}
    />
  );
}
