'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentPairing } from '@/components/providers/current-pairing-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Users } from 'lucide-react';

export function PairingSwitcher() {
  const { currentPairing, pairings, setCurrentPairingId } = useCurrentPairing();
  const router = useRouter();

  if (pairings.length === 0) {
    return (
      <Link
        href="/"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Users className="h-4 w-4" />
        未添加配对
      </Link>
    );
  }

  const elder = currentPairing?.elder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors outline-none">
        {elder ? (
          <>
            <span>{elder.name}</span>
            <Badge
              variant={currentPairing?.isOnline ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {currentPairing?.isOnline ? '在线' : '离线'}
            </Badge>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        ) : (
          <>
            <Users className="h-4 w-4" />
            <span>选择老人</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          切换当前老人
        </div>
        {pairings.map((pairing) => (
          <DropdownMenuItem
            key={pairing.id}
            onClick={() => setCurrentPairingId(pairing.id)}
            className="flex items-center justify-between"
          >
            <span>{pairing.elder.name}</span>
            {currentPairing?.id === pairing.id && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                当前
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/')}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          管理配对
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
