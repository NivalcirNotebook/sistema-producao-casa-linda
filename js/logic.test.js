import { describe, it, expect } from 'vitest';
const { formatDuration, getPctClass } = require('./logic.js');

describe('formatDuration', () => {
  it('deve retornar "—" se os horários não forem informados', () => {
    expect(formatDuration('', '')).toBe('—');
  });

  it('deve calcular a duração corretamente dentro do mesmo dia', () => {
    expect(formatDuration('08:00', '09:30')).toBe('1h 30min');
    expect(formatDuration('10:00', '10:15')).toBe('15min');
  });

  it('deve calcular a duração corretamente atravessando a meia-noite', () => {
    expect(formatDuration('23:00', '01:00')).toBe('2h 0min');
  });

  it('deve retornar "—" para entradas inválidas', () => {
    expect(formatDuration('abc', 'def')).toBe('—');
  });
});

describe('getPctClass', () => {
  it('deve retornar "pct-ok" para porcentagens até 4%', () => {
    expect(getPctClass('2%')).toBe('pct-ok');
    expect(getPctClass('4%')).toBe('pct-ok');
    expect(getPctClass(4)).toBe('pct-ok');
  });

  it('deve retornar "pct-warn" para porcentagens entre 4% e 5%', () => {
    expect(getPctClass('4.5%')).toBe('pct-warn');
    expect(getPctClass('5%')).toBe('pct-warn');
  });

  it('deve retornar "pct-high" para porcentagens acima de 5%', () => {
    expect(getPctClass('5.1%')).toBe('pct-high');
    expect(getPctClass('10%')).toBe('pct-high');
  });

  it('deve retornar string vazia para valores inválidos', () => {
    expect(getPctClass('invalid')).toBe('');
  });
});
