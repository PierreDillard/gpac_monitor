import type { PidPropsMap } from '@/types/domain/gpac';
import type { MessageHandlerDependencies } from './types';
import type { IpidPropsResponseMessage } from '@/services/ws/types';

/**
 * PidPropsHandler
 * Handles fetching PID properties from the server
 * Uses request-response pattern (not subscription)
 */
export class PidPropsHandler {
  private dependencies: MessageHandlerDependencies;
  private pendingRequests = new Map<
    string,
    {
      resolve: (props: PidPropsMap) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(dependencies: MessageHandlerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Handle response from server (called by BaseMessageHandler)
   * @param data - Response message from server
   */
  handleIpidPropsResponse(data: IpidPropsResponseMessage): void {
    const cacheKey = `${data.filterIdx}-${data.ipidIdx}`;
    const pending = this.pendingRequests.get(cacheKey);

    if (!pending) {
      console.warn('[PidPropsHandler] Received unexpected response:', data);
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(cacheKey);

    // Check for error
    if (data.properties?.error) {
      pending.reject(new Error(data.properties.error));
      return;
    }

    // Cache and resolve
    pending.resolve(data.properties);
  }

  /**
   * Fetch IPID properties with caching and timeout
   * @param filterIdx - Destination filter index
   * @param ipidIdx - Input PID index on destination filter
   * @returns Promise resolving to properties map
   */
  async fetchIpidProps(
    filterIdx: number,
    ipidIdx: number,
  ): Promise<PidPropsMap> {
    const cacheKey = `${filterIdx}-${ipidIdx}`;

    // Check if request already pending
    const existing = this.pendingRequests.get(cacheKey);
    if (existing) {
      return new Promise((resolve, reject) => {
        const originalResolve = existing.resolve;
        const originalReject = existing.reject;
        existing.resolve = (props) => {
          originalResolve(props);
          resolve(props);
        };
        existing.reject = (error) => {
          originalReject(error);
          reject(error);
        };
      });
    }

    // Create new request
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(cacheKey);
        reject(
          new Error(
            `Timeout fetching IPID props (filter: ${filterIdx}, pid: ${ipidIdx})`,
          ),
        );
      }, 3000);

      this.pendingRequests.set(cacheKey, { resolve, reject, timeout });

      // Send request via dependencies
      this.dependencies.send({
        type: 'get_ipid_props',
        message: 'get_ipid_props',
        filterIdx,
        ipidIdx,
      });
    });
  }

  /**
   * Cleanup all pending requests and timeouts
   */
  public cleanup(): void {
    this.pendingRequests.forEach((pending) => clearTimeout(pending.timeout));
    this.pendingRequests.clear();
  }
}
