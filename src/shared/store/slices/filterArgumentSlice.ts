import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { selectFilterNameById } from './graphSlice';
import { gpacService } from '@/services/gpacService';
import type {
  GpacArgument,
  GpacArgumentValue,
} from '@/types/domain/gpac/gpac_args';
import type { RootState } from '@/shared/store';

export interface ArgumentUpdate {
  filterId: string;
  name: string;
  value: any;
  status: 'idle' | 'pending' | 'success' | 'error';
  error?: string;
}

export interface FilterArgumentState {
  updates: Record<string, ArgumentUpdate>;
  argsByFilter: Record<string, GpacArgument[]>;
}

const initialState: FilterArgumentState = {
  updates: {},
  argsByFilter: {},
};

// Slice
export const filterArgumentSlice = createSlice({
  name: 'filterArgument',
  initialState,
  reducers: {
    setArgumentUpdateStatus: (state, action: PayloadAction<ArgumentUpdate>) => {
      const key = `${action.payload.filterId}_${action.payload.name}`;
      state.updates[key] = action.payload;
    },
    clearArgumentUpdate: (
      state,
      action: PayloadAction<{
        filterId: string;
        name: string;
      }>,
    ) => {
      const key = `${action.payload.filterId}_${action.payload.name}`;
      delete state.updates[key];
    },
    hydrateFilterArgs: (
      state,
      action: PayloadAction<Record<string, GpacArgument[]>>,
    ) => {
      state.argsByFilter = { ...state.argsByFilter, ...action.payload };
    },
    clearFilterArgs: (state) => {
      state.argsByFilter = {};
    },
    /** Apply a single arg value change from replay (filter_args_update event) */
    applyArgUpdate: (
      state,
      action: PayloadAction<{
        filterIdx: string;
        argName: string;
        value: GpacArgumentValue;
      }>,
    ) => {
      const { filterIdx, argName, value } = action.payload;
      const args = state.argsByFilter[filterIdx];
      if (!args) return;
      const arg = args.find((a) => a.name === argName);
      if (!arg) {
        console.warn(`[Replay] Arg not found: ${filterIdx}.${argName}`);
        return;
      }
      arg.value = value;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(updateFilterArgument.pending, (state, action) => {
      const { filterId, argName, argValue } = action.meta.arg;
      const key = `${filterId}_${argName}`;
      state.updates[key] = {
        filterId,
        name: argName,
        value: argValue,
        status: 'pending',
      };
    });
  },
});

// Actions
export const {
  setArgumentUpdateStatus,
  clearArgumentUpdate,
  hydrateFilterArgs,
  clearFilterArgs,
  applyArgUpdate,
} = filterArgumentSlice.actions;

// Thunk

export const updateFilterArgument = createAsyncThunk<
  void,
  { filterId: string; argName: string; argValue: any },
  { state: RootState }
>(
  'filterArgument/updateFilterArgument',
  async ({ filterId, argName, argValue }, { dispatch, getState }) => {
    const filterName = selectFilterNameById(getState(), filterId);

    if (!filterName) {
      throw new Error(`Filter with ID ${filterId} not found`);
    }

    // Send update to GPAC
    await gpacService.updateFilterArg(
      parseInt(filterId),
      filterName,
      argName,
      argValue,
    );

    dispatch(
      setArgumentUpdateStatus({
        filterId,
        name: argName,
        value: argValue,
        status: 'success',
      }),
    );

    setTimeout(() => {
      dispatch(
        setArgumentUpdateStatus({
          filterId,
          name: argName,
          value: argValue,
          status: 'idle',
        }),
      );
    }, 2000);
  },
);

export {
  selectArgumentUpdate,
  makeSelectArgumentUpdatesForFilter,
} from '@/shared/store/selectors/gpacArgs/filterArgumentSelectors';

export default filterArgumentSlice.reducer;
