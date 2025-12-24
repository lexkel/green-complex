const USER_ID_KEY = 'gc_user_id';
const USER_CREATED_AT_KEY = 'gc_user_created_at';

export class UserIdentity {
  /**
   * Get or create user ID
   * Returns both the ID and whether it was newly created
   * This avoids race conditions with isNewUser() checks
   */
  static getUserId(): { id: string; isNew: boolean } {
    if (typeof window === 'undefined') return { id: '', isNew: false };

    let id = localStorage.getItem(USER_ID_KEY);
    let isNew = false;

    if (!id) {
      id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      localStorage.setItem(USER_ID_KEY, id);
      localStorage.setItem(USER_CREATED_AT_KEY, createdAt);

      isNew = true;
      console.log('[UserIdentity] Created new user ID:', id);
    }

    return { id, isNew };
  }

  /**
   * Get when user was created on this device
   */
  static getCreatedAt(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(USER_CREATED_AT_KEY);
  }

  /**
   * Import recovery code (replaces local data)
   * WARNING: This will replace all local user data
   * User must understand this is destructive
   */
  static importRecoveryCode(recoveryCode: string): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(USER_ID_KEY, recoveryCode);
    localStorage.setItem(USER_CREATED_AT_KEY, new Date().toISOString());

    console.log('[UserIdentity] Imported recovery code');
  }

  /**
   * Get recovery code for backup/restore
   * This is the user ID, but framed as a safety mechanism
   */
  static getRecoveryCode(): string {
    const { id } = this.getUserId();
    return id;
  }
}
