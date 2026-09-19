import { parseAmount } from '../ingredients';
import { normaliseAmount } from '../normaliseAmount';

describe('normaliseAmount', () => {
  it('should turn a decimal comma into a decimal point', () => {
    expect(normaliseAmount('1,5')).toBe('1.5');
  });

  it('should turn a mixed number into a decimal', () => {
    expect(normaliseAmount('1 1/2')).toBe('1.5');
  });

  it('should round a mixed number to three decimals', () => {
    expect(normaliseAmount('1 1/3')).toBe('1.333');
  });

  it('should turn a unicode fraction into a decimal', () => {
    expect(normaliseAmount('½')).toBe('0.5');
  });

  it('should add a unicode fraction to the whole number before it', () => {
    expect(normaliseAmount('1½')).toBe('1.5');
  });

  it('should accept a space between the whole number and a unicode fraction', () => {
    expect(normaliseAmount('2 ¾')).toBe('2.75');
  });

  it('should keep a simple fraction as typed', () => {
    expect(normaliseAmount('1/2')).toBe('1/2');
  });

  it('should remove the spaces around the slash of a simple fraction', () => {
    expect(normaliseAmount('1 / 2')).toBe('1/2');
  });

  it('should keep a plain number as typed', () => {
    expect(normaliseAmount('250')).toBe('250');
  });

  it('should trim and collapse whitespace', () => {
    expect(normaliseAmount('  2   ')).toBe('2');
  });

  it('should return an empty string for a blank amount', () => {
    expect(normaliseAmount('   ')).toBe('');
  });

  it('should leave free text untouched', () => {
    expect(normaliseAmount('a handful')).toBe('a handful');
  });

  it('should leave a range untouched', () => {
    expect(normaliseAmount('2-3')).toBe('2-3');
  });

  it('should leave a mixed number with a zero denominator untouched', () => {
    expect(normaliseAmount('1 1/0')).toBe('1 1/0');
  });

  it('should leave a number with thousands and decimals separators untouched', () => {
    expect(normaliseAmount('1.000,5')).toBe('1.000,5');
  });

  it('should produce amounts that parseAmount reads as the author meant them', () => {
    // parseAmount alone reads '1 1/2' as 0.5 and '1,5' as 1
    const typed = ['1 1/2', '1,5', '1½'];

    const parsed = typed.map((amount) => parseAmount(normaliseAmount(amount)));

    expect(parsed).toEqual([1.5, 1.5, 1.5]);
  });
});
