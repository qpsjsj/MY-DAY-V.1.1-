import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: pass firebaseConfig.firestoreDatabaseId for named Firestore database
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

export function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('PERMISSION_DENIED')
  );
}

export function isNetworkOrOfflineError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string }).code ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('the client is offline') ||
    msg.includes('Failed to get document because the client is offline')
  );
}

export function getKoreanAuthErrorMessage(err: unknown): {
  message: string;
  isProviderDisabled?: boolean;
} {
  const code = (err as { code?: string })?.code ?? '';
  const rawMsg = err instanceof Error ? err.message : String(err ?? '');

  if (code === 'auth/email-already-in-use') {
    return {
      message: '이미 가입된 이메일 주소입니다. 로그인하거나 다른 이메일을 사용해 주세요.',
    };
  }
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return {
      message: '이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.',
    };
  }
  if (code === 'auth/user-not-found') {
    return {
      message: '등록되지 않은 이메일입니다. 회원가입 후 이용해 주세요.',
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      message: '올바른 이메일 주소 형식을 입력해 주세요.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      message: '비밀번호는 6자 이상으로 설정해 주세요.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      message: '로그인 시도가 여러 번 실패하여 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      message: '네트워크 연결이 원활하지 않습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      message: 'Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.',
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      message: '브라우저에서 로그인 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.',
    };
  }
  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/admin-restricted-operation' ||
    rawMsg.includes('OPERATION_NOT_ALLOWED') ||
    rawMsg.includes('PASSWORD_LOGIN_DISABLED')
  ) {
    return {
      isProviderDisabled: true,
      message:
        'Firebase Console의 Authentication > Sign-in method에서 해당 로그인 방식(이메일/비밀번호 또는 Google)이 아직 활성화되지 않았습니다. Console에서 활성화한 뒤 다시 시도해 주세요.',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    return {
      isProviderDisabled: true,
      message:
        '현재 접속 도메인이 Firebase Console의 승인된 도메인(Authorized domains)에 등록되어 있지 않습니다.',
    };
  }
  if (code === 'auth/user-disabled') {
    return {
      message: '비활성화된 계정입니다. 관리자에게 문의해 주세요.',
    };
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return {
      message:
        '이미 다른 로그인 방식으로 가입된 이메일입니다. 기존에 사용하신 방식으로 로그인해 주세요.',
    };
  }

  if (rawMsg.includes('network')) {
    return {
      message: '네트워크 연결 상태를 확인한 뒤 다시 시도해 주세요.',
    };
  }

  return {
    message: '인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  };
}
