// Campaign state for the scheduler (MERGE_PLAN.md Phase 4).
//
// Like `authStore`, this holds no identity of its own: what the caller may do is the server's
// answer, read back from `campaign_members`. The store caches that answer so the UI can hide
// controls the server would refuse, but hiding a button is a courtesy — the check that matters
// happens on the route.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listCampaignMembers, listCampaigns } from '@/lib/api';
import type { Campaign, CampaignMember, CampaignPermissions } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/** Every grantable flag, in the order the permissions editor shows them. */
export const CAMPAIGN_PERMISSION_FLAGS = [
  { key: 'can_create_players', label: 'Add players', hint: 'Create new seats in the roster' },
  { key: 'can_delete_players', label: 'Remove players', hint: 'Delete any seat, not just their own' },
  { key: 'can_manage_groups', label: 'Manage groups', hint: 'Create, edit and delete tables' },
  { key: 'can_create_invites', label: 'Create invites', hint: 'Mint and revoke invite links' },
  { key: 'can_edit_self', label: 'Edit own seat', hint: 'Change the name, timezone and notes on the seat they hold' },
  { key: 'players_self_delete', label: 'Release own seat', hint: 'Give up or delete the seat they hold' },
] as const satisfies readonly { key: keyof CampaignPermissions; label: string; hint: string }[];

/** What a campaign grants arrivals when it has never said — mirrors the server's own floor. */
export const DEFAULT_MEMBER_PERMISSIONS: CampaignPermissions = { can_edit_self: true, players_self_delete: true };

export type CampaignPermissionFlag = (typeof CAMPAIGN_PERMISSION_FLAGS)[number]['key'];

/**
 * Read a member's permission blob. The server stores it as a JSON string and tolerates junk, so a
 * client that parses it at nine call sites swallows nine different parse errors — do it once.
 */
export function parsePermissions(member: Pick<CampaignMember, 'permissions'> | null | undefined): CampaignPermissions {
  if (!member?.permissions) return {};
  try {
    const parsed: unknown = JSON.parse(member.permissions);
    if (!parsed || typeof parsed !== 'object') return {};
    return canonicalisePermissions(parsed as CampaignPermissions);
  } catch (e) {
    console.warn('campaign member permissions are not valid JSON', e instanceof Error ? e.message : e);
    return {};
  }
}

/**
 * `can_unclaim` is the older name for `players_self_delete` and rows written by the claim flow
 * carry it, so reading it as its own flag left the switch off for a right the member actually
 * holds. Writing back the canonical shape is what retires it.
 */
function canonicalisePermissions(permissions: CampaignPermissions): CampaignPermissions {
  const { can_unclaim, ...rest } = permissions;
  return can_unclaim ? { ...rest, players_self_delete: true } : rest;
}

interface CampaignState {
  campaigns: Campaign[];
  /** The campaign whose pages are open. Persisted so a reload lands where you left off. */
  activeCampaignId: number | null;
  /** The caller's own membership row for `activeCampaignId`, or null when not resolved yet. */
  membership: CampaignMember | null;
  loading: boolean;
  error: string | null;

  setActiveCampaign: (campaignId: number | null) => void;
  loadCampaigns: () => Promise<Campaign[]>;
  loadMembership: (campaignId: number) => Promise<void>;
  upsertCampaign: (campaign: Campaign) => void;
  removeCampaign: (campaignId: number) => void;
  reset: () => void;
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set, get) => ({
      campaigns: [],
      activeCampaignId: null,
      membership: null,
      loading: false,
      error: null,

      setActiveCampaign: (campaignId) => {
        if (get().activeCampaignId === campaignId) return;
        // The old membership belongs to the old campaign; keeping it would answer "may I?" for
        // the wrong campaign until the new row arrives.
        set({ activeCampaignId: campaignId, membership: null });
      },

      loadCampaigns: async () => {
        set({ loading: true, error: null });
        try {
          const campaigns = await listCampaigns();
          set({ campaigns, loading: false });
          return campaigns;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          set({ loading: false, error: message });
          return [];
        }
      },

      loadMembership: async (campaignId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
          set({ membership: null });
          return;
        }
        try {
          const members = await listCampaignMembers(campaignId);
          set({ membership: members.find((m) => m.user_id === userId) ?? null });
        } catch (e) {
          console.warn('could not resolve campaign membership', e instanceof Error ? e.message : e);
          set({ membership: null });
        }
      },

      upsertCampaign: (campaign) =>
        set((state) => {
          const index = state.campaigns.findIndex((c) => c.id === campaign.id);
          if (index === -1) return { campaigns: [...state.campaigns, campaign] };
          const campaigns = state.campaigns.slice();
          campaigns[index] = campaign;
          return { campaigns };
        }),

      removeCampaign: (campaignId) =>
        set((state) => ({
          campaigns: state.campaigns.filter((c) => c.id !== campaignId),
          activeCampaignId: state.activeCampaignId === campaignId ? null : state.activeCampaignId,
          membership: state.activeCampaignId === campaignId ? null : state.membership,
        })),

      reset: () => set({ campaigns: [], activeCampaignId: null, membership: null, error: null }),
    }),
    {
      name: 'dnd-campaign-ui',
      // Only the selection is worth remembering. The campaign list and the membership row are the
      // server's to state, and a stale cached permission would show a control the server refuses.
      partialize: (state) => ({ activeCampaignId: state.activeCampaignId }),
    },
  ),
);

export function isCampaignOwner(membership: CampaignMember | null): boolean {
  return membership?.role === 'owner';
}

/** Owners hold every right implicitly; everyone else holds what the blob grants. */
export function memberCan(membership: CampaignMember | null, ...flags: CampaignPermissionFlag[]): boolean {
  if (isCampaignOwner(membership)) return true;
  const permissions = parsePermissions(membership);
  return flags.some((flag) => Boolean(permissions[flag]));
}

/** The seat this member sits in, when they have claimed one. */
export function membershipPlayerId(membership: CampaignMember | null): number | null {
  return membership?.player_id ?? null;
}
