// Tests for the money math. Run with: npm test -w server
import { describe, expect, it } from 'vitest';
import { netBalances, settleUp, splitByPercent, splitEqually } from './balances.js';

const sum = (shares: { amount: number }[]) => shares.reduce((total, s) => total + s.amount, 0);

describe('splitEqually', () => {
  it('splits evenly when it divides exactly', () => {
    expect(splitEqually(900, ['a', 'b', 'c']).map((s) => s.amount)).toEqual([300, 300, 300]);
  });

  it('gives leftover paise to the first people so shares add up to the total', () => {
    expect(splitEqually(1000, ['a', 'b', 'c']).map((s) => s.amount)).toEqual([334, 333, 333]);
    expect(splitEqually(1001, ['a', 'b', 'c']).map((s) => s.amount)).toEqual([334, 334, 333]);
  });

  it('always adds up exactly, for many totals and group sizes', () => {
    for (let total = 1; total <= 500; total++) {
      for (let people = 1; people <= 7 && people <= total; people++) {
        const ids = Array.from({ length: people }, (_, i) => `u${i}`);
        expect(sum(splitEqually(total, ids))).toBe(total);
      }
    }
  });
});

describe('splitByPercent', () => {
  it('splits 33.33 / 33.33 / 33.34 of ₹100 exactly', () => {
    const shares = splitByPercent(10000, [
      { userId: 'a', basisPoints: 3333 },
      { userId: 'b', basisPoints: 3333 },
      { userId: 'c', basisPoints: 3334 },
    ]);
    expect(shares.map((s) => s.amount)).toEqual([3333, 3333, 3334]);
  });

  it('gives the leftover paisa to the share that was rounded down the most', () => {
    // 50/50 of ₹10.01: both are 500.5 paise, so the tie goes to the first person.
    const halves = splitByPercent(1001, [
      { userId: 'a', basisPoints: 5000 },
      { userId: 'b', basisPoints: 5000 },
    ]);
    expect(halves.map((s) => s.amount)).toEqual([501, 500]);

    // 10% / 90% of 15 paise: 1.5 and 13.5. Both round down by 0.5, so the first gets it again.
    const uneven = splitByPercent(15, [
      { userId: 'a', basisPoints: 1000 },
      { userId: 'b', basisPoints: 9000 },
    ]);
    expect(uneven.map((s) => s.amount)).toEqual([2, 13]);
  });

  it('always adds up exactly', () => {
    const parts = [
      { userId: 'a', basisPoints: 1250 },
      { userId: 'b', basisPoints: 3333 },
      { userId: 'c', basisPoints: 5417 },
    ];
    for (let total = 1; total <= 2000; total++) expect(sum(splitByPercent(total, parts))).toBe(total);
  });
});

describe('netBalances', () => {
  it('is what you paid minus what you owe, and everyone adds up to 0', () => {
    const balances = netBalances(
      ['a', 'b', 'c'],
      [
        { amount: 1000, paidById: 'a', shares: splitEqually(1000, ['a', 'b', 'c']) },
        { amount: 300, paidById: 'b', shares: splitEqually(300, ['b', 'c']) },
      ],
    );
    expect(Object.fromEntries(balances)).toEqual({ a: 666, b: -183, c: -483 });
    expect([...balances.values()].reduce((x, y) => x + y, 0)).toBe(0);
  });

  it('counts a payment back towards settling up', () => {
    const expenses = [{ amount: 900, paidById: 'a', shares: splitEqually(900, ['a', 'b', 'c']) }];
    const balances = netBalances(['a', 'b', 'c'], expenses, [{ fromId: 'b', toId: 'a', amount: 300 }]);
    expect(Object.fromEntries(balances)).toEqual({ a: 300, b: 0, c: -300 });
  });

  it('includes members with no expenses at 0', () => {
    expect(Object.fromEntries(netBalances(['a', 'b'], []))).toEqual({ a: 0, b: 0 });
  });
});

describe('settleUp', () => {
  it('returns no payments when everyone is settled', () => {
    expect(settleUp(new Map([['a', 0], ['b', 0]]))).toEqual([]);
  });

  it('has the biggest debtor pay the biggest creditor first', () => {
    const payments = settleUp(new Map([['a', 666], ['b', -183], ['c', -483]]));
    expect(payments).toEqual([
      { from: 'c', to: 'a', amount: 483 },
      { from: 'b', to: 'a', amount: 183 },
    ]);
  });

  it('settles everyone to exactly 0 in at most (people - 1) payments', () => {
    // A fixed pseudo-random sequence, so the test does the same thing every run.
    let seed = 42;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    for (let round = 0; round < 200; round++) {
      const people = 2 + Math.floor(random() * 8);
      const ids = Array.from({ length: people }, (_, i) => `u${i}`);
      const expenses = Array.from({ length: 1 + Math.floor(random() * 6) }, () => {
        const amount = 1 + Math.floor(random() * 100000);
        const splitWith = ids.filter(() => random() < 0.7);
        if (splitWith.length === 0) splitWith.push(ids[0]);
        return { amount, paidById: ids[Math.floor(random() * people)], shares: splitEqually(amount, splitWith) };
      });

      const balances = netBalances(ids, expenses);
      const payments = settleUp(balances);
      expect(payments.length).toBeLessThanOrEqual(people - 1);

      for (const p of payments) {
        expect(p.amount).toBeGreaterThan(0);
        balances.set(p.from, balances.get(p.from)! + p.amount);
        balances.set(p.to, balances.get(p.to)! - p.amount);
      }
      expect([...balances.values()].every((b) => b === 0)).toBe(true);
    }
  });
});
