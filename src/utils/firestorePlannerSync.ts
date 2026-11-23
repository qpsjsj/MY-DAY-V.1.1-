import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PlannerRecord, PlannerWorkspace } from '../types/planner';
import {
  preparePlannerStateForFirestore,
  sanitizeFirestoreDocId,
  sanitizePlannerWorkspace,
} from './storage';

export interface CloudAuthUserInfo {
  uid: string;
  email: string;
  displayName: string;
}

function normalizeWorkspaceForCloudIds(ws: PlannerWorkspace): PlannerWorkspace {
  const planners: PlannerRecord[] = ws.planners.map((p, idx) => ({
    ...p,
    plannerId: sanitizeFirestoreDocId(p.plannerId, `planner-${idx + 1}`),
    name: p.name.trim().slice(0, 40) || `플래너 ${idx + 1}`,
    data: preparePlannerStateForFirestore(p.data),
  }));
  const activeId = sanitizeFirestoreDocId(ws.activePlannerId, planners[0]?.plannerId || 'planner-initial');
  return {
    ...ws,
    activePlannerId: planners.some((p) => p.plannerId === activeId)
      ? activeId
      : planners[0].plannerId,
    planners,
  };
}

export async function fetchUserCloudWorkspace(uid: string): Promise<{
  exists: boolean;
  workspace: PlannerWorkspace | null;
}> {
  const userPath = `users/${uid}`;
  const plannersPath = `users/${uid}/planners`;

  let userSnap;
  try {
    userSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let plannersSnap;
  try {
    const q = query(collection(db, 'users', uid, 'planners'), where('ownerId', '==', uid));
    plannersSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, plannersPath);
  }

  if (!userSnap.exists() || plannersSnap.empty) {
    return { exists: false, workspace: null };
  }

  const meta = userSnap.data() as {
    stage?: string;
    hasOpenedApp?: boolean;
    activePlannerId?: string;
  };

  const rawPlanners: PlannerRecord[] = [];
  plannersSnap.forEach((docSnap) => {
    const d = docSnap.data() as {
      plannerId?: string;
      name?: string;
      clientUpdatedAt?: string;
      createdAt?: { toDate?: () => Date };
      updatedAt?: { toDate?: () => Date };
      data?: unknown;
    };
    const createdIso = d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString();
    const updatedIso =
      d.clientUpdatedAt ||
      (d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : createdIso);
    rawPlanners.push({
      plannerId: d.plannerId || docSnap.id,
      name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : '나의 플래너',
      createdAt: createdIso,
      updatedAt: updatedIso,
      data: d.data as PlannerRecord['data'],
    });
  });

  rawPlanners.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const workspace = sanitizePlannerWorkspace({
    version: 3,
    stage: meta.stage || 'app',
    hasOpenedApp: meta.hasOpenedApp ?? true,
    activePlannerId: meta.activePlannerId,
    planners: rawPlanners,
  });

  return { exists: true, workspace };
}

export async function initializeUserCloudWorkspace(
  user: CloudAuthUserInfo,
  rawWorkspace: PlannerWorkspace
): Promise<PlannerWorkspace> {
  const cleanWs = normalizeWorkspaceForCloudIds(rawWorkspace);
  const userPath = `users/${user.uid}`;
  const batch = writeBatch(db);

  batch.set(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email.slice(0, 254),
    displayName: user.displayName.slice(0, 80),
    stage: cleanWs.stage,
    hasOpenedApp: Boolean(cleanWs.hasOpenedApp),
    activePlannerId: cleanWs.activePlannerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const planner of cleanWs.planners) {
    batch.set(doc(db, 'users', user.uid, 'planners', planner.plannerId), {
      ownerId: user.uid,
      plannerId: planner.plannerId,
      name: planner.name,
      clientUpdatedAt: (planner.updatedAt || new Date().toISOString()).slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      data: planner.data,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  return cleanWs;
}

export async function syncWorkspaceDiffToFirestore(
  user: CloudAuthUserInfo,
  rawNextWorkspace: PlannerWorkspace,
  prevSyncedWorkspace: PlannerWorkspace | null
): Promise<PlannerWorkspace> {
  if (!prevSyncedWorkspace) {
    return initializeUserCloudWorkspace(user, rawNextWorkspace);
  }

  const nextWs = normalizeWorkspaceForCloudIds(rawNextWorkspace);
  const prevWs = normalizeWorkspaceForCloudIds(prevSyncedWorkspace);

  const prevById = new Map(prevWs.planners.map((p) => [p.plannerId, p]));
  const nextById = new Map(nextWs.planners.map((p) => [p.plannerId, p]));

  const batch = writeBatch(db);
  let opCount = 0;

  // Create or update planners
  for (const planner of nextWs.planners) {
    const prev = prevById.get(planner.plannerId);
    const ref = doc(db, 'users', user.uid, 'planners', planner.plannerId);

    if (!prev) {
      batch.set(ref, {
        ownerId: user.uid,
        plannerId: planner.plannerId,
        name: planner.name,
        clientUpdatedAt: (planner.updatedAt || new Date().toISOString()).slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        data: planner.data,
      });
      opCount += 1;
    } else {
      const changed =
        prev.name !== planner.name ||
        prev.updatedAt !== planner.updatedAt ||
        JSON.stringify(prev.data) !== JSON.stringify(planner.data);
      if (changed) {
        batch.update(ref, {
          name: planner.name,
          data: planner.data,
          clientUpdatedAt: (planner.updatedAt || new Date().toISOString()).slice(0, 64),
          updatedAt: serverTimestamp(),
        });
        opCount += 1;
      }
    }
  }

  // Delete removed planners
  for (const prev of prevWs.planners) {
    if (!nextById.has(prev.plannerId)) {
      batch.delete(doc(db, 'users', user.uid, 'planners', prev.plannerId));
      opCount += 1;
    }
  }

  // Update workspace metadata if changed
  const metaChanged =
    prevWs.stage !== nextWs.stage ||
    Boolean(prevWs.hasOpenedApp) !== Boolean(nextWs.hasOpenedApp) ||
    prevWs.activePlannerId !== nextWs.activePlannerId;

  if (metaChanged) {
    batch.update(doc(db, 'users', user.uid), {
      email: user.email.slice(0, 254),
      displayName: user.displayName.slice(0, 80),
      stage: nextWs.stage,
      hasOpenedApp: Boolean(nextWs.hasOpenedApp),
      activePlannerId: nextWs.activePlannerId,
      updatedAt: serverTimestamp(),
    });
    opCount += 1;
  }

  if (opCount === 0) {
    return nextWs;
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  return nextWs;
}

export function subscribeToUserCloudWorkspace(
  uid: string,
  onRemoteWorkspace: (ws: PlannerWorkspace) => void,
  onError: (err: unknown) => void
): () => void {
  const userPath = `users/${uid}`;
  const plannersPath = `users/${uid}/planners`;

  let latestMeta: {
    stage?: string;
    hasOpenedApp?: boolean;
    activePlannerId?: string;
  } | null = null;
  let latestPlanners: PlannerRecord[] | null = null;

  const emitIfReady = () => {
    if (!latestMeta || !latestPlanners || latestPlanners.length === 0) return;
    const sorted = [...latestPlanners].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ws = sanitizePlannerWorkspace({
      version: 3,
      stage: latestMeta.stage || 'app',
      hasOpenedApp: latestMeta.hasOpenedApp ?? true,
      activePlannerId: latestMeta.activePlannerId,
      planners: sorted,
    });
    onRemoteWorkspace(ws);
  };

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      latestMeta = snap.data() as {
        stage?: string;
        hasOpenedApp?: boolean;
        activePlannerId?: string;
      };
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, userPath);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );

  const q = query(collection(db, 'users', uid, 'planners'), where('ownerId', '==', uid));
  const unsubPlanners = onSnapshot(
    q,
    (snap) => {
      if (snap.metadata.hasPendingWrites || snap.empty) return;
      const list: PlannerRecord[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as {
          plannerId?: string;
          name?: string;
          clientUpdatedAt?: string;
          createdAt?: { toDate?: () => Date };
          updatedAt?: { toDate?: () => Date };
          data?: unknown;
        };
        const createdIso = d.createdAt?.toDate
          ? d.createdAt.toDate().toISOString()
          : new Date().toISOString();
        const updatedIso =
          d.clientUpdatedAt ||
          (d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : createdIso);
        list.push({
          plannerId: d.plannerId || docSnap.id,
          name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : '나의 플래너',
          createdAt: createdIso,
          updatedAt: updatedIso,
          data: d.data as PlannerRecord['data'],
        });
      });
      latestPlanners = list;
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, plannersPath);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );

  return () => {
    unsubUser();
    unsubPlanners();
  };
}
