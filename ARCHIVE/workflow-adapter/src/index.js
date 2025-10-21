import { Status, Roles, ROLE_TRANSITIONS, ACTION_LABELS, ACTION_ICONS, ACTION_TYPES, MACHINE_RESTRICTED_ROLES } from './config.js'

function ensureArray(v) { return Array.isArray(v) ? v : (v != null ? [v] : []) }

export function canTransition(user, job, newStatus) {
  const userRole = user.role
  const currentStatus = job.status

  const roleMap = ROLE_TRANSITIONS[userRole]
  if (!roleMap) {
    return { allowed: false, reason: `Rôle ${userRole} non autorisé à modifier les statuts` }
  }

  const allowedFrom = roleMap[currentStatus]
  if (!allowedFrom || !allowedFrom.includes(newStatus)) {
    return { allowed: false, reason: `Transition ${currentStatus} → ${newStatus} non autorisée pour ${userRole}` }
  }

  switch (userRole) {
    case Roles.PREPARATEUR:
      if (job.createdById !== user.id) {
        return { allowed: false, reason: 'Vous ne pouvez modifier que vos propres dossiers' }
      }
      break
    case Roles.IMPRIMEUR_ROLAND:
      if (job.machineType !== 'roland') {
        return { allowed: false, reason: 'Vous ne pouvez traiter que les jobs Roland' }
      }
      break
    case Roles.IMPRIMEUR_XEROX:
      if (job.machineType !== 'xerox') {
        return { allowed: false, reason: 'Vous ne pouvez traiter que les jobs Xerox' }
      }
      break
    case Roles.IMPRIMEUR:
      if (!['roland', 'xerox'].includes(job.machineType)) {
        return { allowed: false, reason: 'Type de machine non supporté' }
      }
      break
  }

  return { allowed: true }
}

export function getAvailableActions(user, job) {
  const roleMap = ROLE_TRANSITIONS[user.role]
  const current = job.status
  const actions = []
  if (!roleMap || !roleMap[current]) return actions
  for (const next of roleMap[current]) {
    const check = canTransition(user, job, next)
    if (check.allowed) {
      actions.push({
        status: next,
        label: ACTION_LABELS[current]?.[next] || `Passer en ${next}`,
        icon: ACTION_ICONS[next] || '🔄',
        type: ACTION_TYPES[next] || 'primary'
      })
    }
  }
  return actions
}

export function canDeleteJob(user, job) {
  if (user.role === Roles.PREPARATEUR && job.createdById === user.id && job.status === Status.PREPARATION) {
    return { allowed: true }
  }
  if (user.role === Roles.ADMIN) return { allowed: true }
  return { allowed: false, reason: 'Vous ne pouvez supprimer que vos dossiers en préparation' }
}

export function canViewJob(user, job) {
  switch (user.role) {
    case Roles.ADMIN:
      return true
    case Roles.PREPARATEUR:
      return job.createdById === user.id
    case Roles.IMPRIMEUR:
      return [Status.READY, Status.IN_PROGRESS, Status.COMPLETED].includes(job.status)
    case Roles.IMPRIMEUR_ROLAND:
      return job.machineType === 'roland' && [Status.READY, Status.IN_PROGRESS, Status.COMPLETED].includes(job.status)
    case Roles.IMPRIMEUR_XEROX:
      return job.machineType === 'xerox' && [Status.READY, Status.IN_PROGRESS, Status.COMPLETED].includes(job.status)
    case Roles.LIVREUR:
      return [Status.COMPLETED, Status.IN_DELIVERY, Status.DELIVERED].includes(job.status)
    default:
      return false
  }
}

export function getNotifications(job, oldStatus, newStatus, changedBy) {
  const n = []
  if (newStatus === Status.READY) {
    if (job.machineType === 'roland') {
      n.push({ targetRoles: [Roles.IMPRIMEUR, Roles.IMPRIMEUR_ROLAND, Roles.ADMIN], type: 'jobReady', message: `Nouveau job prêt: ${job.jobNumber} (Roland)`, job, changedBy })
    } else if (job.machineType === 'xerox') {
      n.push({ targetRoles: [Roles.IMPRIMEUR, Roles.IMPRIMEUR_XEROX, Roles.ADMIN], type: 'jobReady', message: `Nouveau job prêt: ${job.jobNumber} (Xerox)`, job, changedBy })
    }
  } else if (newStatus === Status.COMPLETED) {
    n.push({ targetRoles: [Roles.LIVREUR, Roles.ADMIN], type: 'jobCompleted', message: `Job terminé et prêt pour livraison: ${job.jobNumber}`, job, changedBy })
  } else if (newStatus === Status.REVISION) {
    n.push({ targetUsers: [job.createdById], targetRoles: [Roles.ADMIN], type: 'jobNeedsRevision', message: `Révision demandée pour ${job.jobNumber}`, job, changedBy })
  } else if (newStatus === Status.DELIVERED) {
    n.push({ targetUsers: [job.createdById], targetRoles: [Roles.ADMIN], type: 'jobDelivered', message: `Job livré: ${job.jobNumber}`, job, changedBy })
  }
  return n
}

export { Status, Roles, ROLE_TRANSITIONS, ACTION_LABELS, ACTION_ICONS, ACTION_TYPES, MACHINE_RESTRICTED_ROLES }
