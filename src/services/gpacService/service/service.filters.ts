import { GpacServiceState } from './service.types';
import { generateID } from '@/utils/core';
import { PidProperty } from '@/types';
import type { GpacMessage } from '@/types/communication/shared';

export const filterMethods = {
  /**
   * Request filter details and arguments
   * Stops previous filter details if different
   */
  getFilterDetails(
    state: GpacServiceState,
    idx: number,
    sendMessage: (message: GpacMessage) => void,
  ): void {
    const currentFilterId = state.coreService.getCurrentFilterId();
    if (currentFilterId !== null && currentFilterId !== idx) {
      sendMessage({ type: 'stop_details', idx: currentFilterId });
    }
    state.coreService.setCurrentFilterId(idx);
    sendMessage({
      type: 'filter_args_details',
      id: generateID(),
      idx: idx,
    });
  },

  /**
   * Set current filter ID for detail tracking
   */
  setCurrentFilterId(state: GpacServiceState, id: number | null): void {
    state.coreService.setCurrentFilterId(id);
  },

  /**
   * Get currently tracked filter ID
   */
  getCurrentFilterId(state: GpacServiceState): number | null {
    return state.coreService.getCurrentFilterId();
  },

  /**
   * Subscribe to filter arguments updates
   */
  async subscribeToFilterArgs(
    state: GpacServiceState,
    idx: number,
  ): Promise<void> {
    return state.messageHandler
      .getFilterArgsHandler()
      .subscribeToFilterArgs(idx);
  },

  /**
   * Unsubscribe from filter updates
   */
  unsubscribeFromFilter(
    filterIdx: string,
    sendMessage: (message: GpacMessage) => void,
  ): void {
    const numericIdx = parseInt(filterIdx, 10);
    if (!isNaN(numericIdx)) {
      sendMessage({ type: 'stop_details', idx: numericIdx });
    }
  },

  /**
   * Update filter argument value
   */
  async updateFilterArg(
    state: GpacServiceState,
    idx: number,
    name: string,
    argName: string,
    newValue: string | number | boolean | null,
    isLoaded: () => boolean,
  ): Promise<void> {
    if (!isLoaded()) {
      throw new Error('Service not loaded');
    }

    return state.messageHandler
      .getFilterArgsHandler()
      .updateFilterArg(idx, name, argName, newValue);
  },

  /**
   * Get PID properties for a specific filter input PID
   */
  async getPidProps(
    state: GpacServiceState,
    filterIdx: number | undefined,
    ipidIdx: number | undefined,
    isLoaded: () => boolean,
  ): Promise<PidProperty[]> {
    if (!isLoaded()) {
      throw new Error('Service not loaded');
    }
    if (typeof filterIdx !== 'number' || typeof ipidIdx !== 'number') {
      throw new Error('filterIdx and ipidIdx must be numbers');
    }
    const pidPropsMap = await state.messageHandler
      .getPidPropsHandler()
      .fetchIpidProps(filterIdx, ipidIdx);
    return Object.values(pidPropsMap);
  },

  /**
   * Get GPAC command line
   */
  async getCommandLine(
    state: GpacServiceState,
    isLoaded: () => boolean,
  ): Promise<string | null> {
    if (!isLoaded()) {
      throw new Error('Service not loaded');
    }
    return state.messageHandler.getCommandLineHandler().fetch();
  },

  /**
   * Get filter args handler (for direct access)
   */
  getFilterArgsHandler(state: GpacServiceState) {
    return state.messageHandler.getFilterArgsHandler();
  },

  /**
   * Get filter subscriptions store
   */
  getFilterSubscriptions(state: GpacServiceState) {
    return state.filterSubscriptionsStore;
  },
};
