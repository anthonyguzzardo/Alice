/// <reference path="../.astro/types.d.ts" />

import type { Subject } from './lib/libSubject.ts';

declare global {
  namespace App {
    interface Locals {
      /**
       * The authenticated subject for this request, set by `src/middleware.ts`
       * if a valid session cookie is present. `null` for anonymous traffic.
       *
       * Endpoints under `/api/subject/*` (other than `/api/subject/login`) can
       * assume this is non-null and `is_owner === false` because the middleware
       * enforces both before invoking the handler.
       */
      subject: Subject | null;
    }
  }
}

export {};
