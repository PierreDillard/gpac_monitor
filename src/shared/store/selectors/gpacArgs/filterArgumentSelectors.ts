import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../index';
import {
  ArgumentUpdate,
  FilterArgumentState,
} from '@/shared/store/slices/filterArgumentSlice';
import type { GpacArgument } from '@/types/domain/gpac/gpac_args';

export const selectArgumentUpdate = (
  state: { filterArgument: FilterArgumentState },
  filterId: string,
  name: string,
) => {
  const key = `${filterId}_${name}`;
  return state.filterArgument.updates[key];
};

/** Memoized selector for filter argument updates by filter */
export const makeSelectArgumentUpdatesForFilter = () =>
  createSelector(
    [
      (state: RootState) => state.filterArgument.updates,
      (_: RootState, filterId: string) => filterId,
      (_: RootState, __: string, gpacArgs: GpacArgument[]) => gpacArgs,
    ],
    (updates, filterId, gpacArgs) => {
      if (!Array.isArray(gpacArgs)) return {};

      return gpacArgs.reduce<Record<string, ArgumentUpdate>>((acc, arg) => {
        const key = `${filterId}_${arg.name}`;
        const update = updates[key];
        if (update) {
          acc[arg.name] = update;
        }
        return acc;
      }, {});
    },
  );
