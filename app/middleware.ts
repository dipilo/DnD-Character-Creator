import { next } from '@vercel/edge';

export const config = {
  matcher: [],
};

export default function middleware() {
  return next();
}
