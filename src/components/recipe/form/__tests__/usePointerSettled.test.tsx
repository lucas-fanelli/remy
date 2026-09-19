import { fireEvent, renderHook } from '@testing-library/react';
import { usePointerSettled } from '../usePointerSettled';

describe('usePointerSettled', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should run a job at once when no pointer is pressed', () => {
    const { result } = renderHook(() => usePointerSettled());
    const job = jest.fn();

    result.current(job);

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('should hold a job while a pointer is pressed', () => {
    const { result } = renderHook(() => usePointerSettled());
    const job = jest.fn();
    fireEvent.pointerDown(document.body);

    result.current(job);

    expect(job).not.toHaveBeenCalled();
  });

  it('should run the job after the release, once the click had its turn', () => {
    const { result } = renderHook(() => usePointerSettled());
    const job = jest.fn();
    fireEvent.pointerDown(document.body);
    result.current(job);

    fireEvent.pointerUp(document.body);
    expect(job).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('should run the job when the press is cancelled', () => {
    const { result } = renderHook(() => usePointerSettled());
    const job = jest.fn();
    fireEvent.pointerDown(document.body);
    result.current(job);

    fireEvent.pointerCancel(document.body);
    jest.runAllTimers();

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('should run jobs at once again after the release', () => {
    const { result } = renderHook(() => usePointerSettled());
    const job = jest.fn();
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);

    result.current(job);

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('should not lose a held job when the editor unmounts', () => {
    const { result, unmount } = renderHook(() => usePointerSettled());
    const job = jest.fn();
    fireEvent.pointerDown(document.body);
    result.current(job);

    unmount();

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('should stop listening after the editor unmounts', () => {
    const { result, unmount } = renderHook(() => usePointerSettled());
    const job = jest.fn();
    unmount();
    fireEvent.pointerDown(document.body);

    result.current(job);

    expect(job).toHaveBeenCalledTimes(1);
  });
});
