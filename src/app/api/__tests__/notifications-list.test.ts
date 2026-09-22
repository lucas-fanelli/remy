/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/container/container', () => ({
  container: { getNotificationService: jest.fn() },
}));
jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: { followRequest: { count: jest.fn() } },
}));
jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logServerError: jest.fn() }));

import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { GET } from '../notifications/route';

const OWNER = 'owner-1';
const INBOX = { notifications: [], unreadCount: 3, total: 7 };

const notificationService = { getUserNotifications: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (container.getNotificationService as jest.Mock).mockReturnValue(notificationService);
  (requireAuth as jest.Mock).mockResolvedValue({ id: OWNER });
  notificationService.getUserNotifications.mockResolvedValue(INBOX);
  (prisma.followRequest.count as jest.Mock).mockResolvedValue(2);
});

function list(query = '') {
  return GET(new NextRequest(`http://localhost:3000/api/notifications${query}`));
}

describe('GET /api/notifications — pendingRequestsCount', () => {
  it('counts the follow requests waiting on the signed-in account, with one query', async () => {
    const response = await list('?limit=10&offset=20');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...INBOX, pendingRequestsCount: 2 });
    expect(prisma.followRequest.count).toHaveBeenCalledTimes(1);
    expect(prisma.followRequest.count).toHaveBeenCalledWith({ where: { targetId: OWNER } });
    // The notifications themselves are unchanged, paging included
    expect(notificationService.getUserNotifications).toHaveBeenCalledWith(OWNER, 10, 20);
  });

  it('is 0 when nothing is waiting, never missing', async () => {
    (prisma.followRequest.count as jest.Mock).mockResolvedValue(0);

    const body = await (await list()).json();

    expect(body.pendingRequestsCount).toBe(0);
  });

  it('counts nothing for a signed-out visitor', async () => {
    (requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'));

    const response = await list();

    expect(response.status).toBe(401);
    expect(prisma.followRequest.count).not.toHaveBeenCalled();
  });

  it('answers the usual 500 when the count fails', async () => {
    (prisma.followRequest.count as jest.Mock).mockRejectedValue(new Error('connection lost'));

    const response = await list();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch notifications',
      code: 'notification.fetchFailed',
    });
  });
});
