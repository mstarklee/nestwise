import 'server-only';
import type { Db } from '@nestwise/db';
import { ResolveSessionUseCase, SignInUseCase, SignOutUseCase, SignUpUseCase } from '@nestwise/domain/auth';
import { DrizzleSessionGateway } from '../adapters/auth/drizzle-session-gateway';
import { DrizzleUserGateway } from '../adapters/auth/drizzle-user-gateway';
import { RandomTokenGenerator } from '../adapters/auth/random-token-generator';
import { ScryptPasswordHasher } from '../adapters/auth/scrypt-password-hasher';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

export const makeSignUpUseCase = (db: Db = getDb()) =>
  new SignUpUseCase(
    new DrizzleUserGateway(db),
    new DrizzleSessionGateway(db),
    new ScryptPasswordHasher(),
    uuidIds,
    new RandomTokenGenerator(),
    systemClock,
  );

export const makeSignInUseCase = (db: Db = getDb()) =>
  new SignInUseCase(
    new DrizzleUserGateway(db),
    new DrizzleSessionGateway(db),
    new ScryptPasswordHasher(),
    new RandomTokenGenerator(),
    systemClock,
  );

export const makeSignOutUseCase = (db: Db = getDb()) => new SignOutUseCase(new DrizzleSessionGateway(db));

export const makeResolveSessionUseCase = (db: Db = getDb()) =>
  new ResolveSessionUseCase(new DrizzleUserGateway(db), new DrizzleSessionGateway(db), systemClock);
