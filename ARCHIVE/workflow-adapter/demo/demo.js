import { canTransition, getAvailableActions, canDeleteJob, canViewJob, getNotifications, Status, Roles } from '../src/index.js'

const admin = { id: 'u1', role: Roles.ADMIN }
const prep = { id: 'u2', role: Roles.PREPARATEUR }
const impRoland = { id: 'u3', role: Roles.IMPRIMEUR_ROLAND }
const livreur = { id: 'u4', role: Roles.LIVREUR }

const job = { id: 'j1', jobNumber: 'IMP123', status: Status.PREPARATION, machineType: 'roland', createdById: prep.id }

function log(title, data) { console.log(`\n=== ${title} ===`); console.log(data) }

log('Actions PREPARATEUR en PREPARATION', getAvailableActions(prep, job))
console.log('Transition PREPARATEUR PREPARATION→READY:', canTransition(prep, job, Status.READY))

const jobReady = { ...job, status: Status.READY }
log('Actions IMPRIMEUR_ROLAND en READY', getAvailableActions(impRoland, jobReady))
console.log('Transition IMPRIMEUR READY→IN_PROGRESS:', canTransition(impRoland, jobReady, Status.IN_PROGRESS))

const jobInProgress = { ...job, status: Status.IN_PROGRESS }
console.log('Transition IMPRIMEUR IN_PROGRESS→COMPLETED:', canTransition(impRoland, jobInProgress, Status.COMPLETED))

const jobCompleted = { ...job, status: Status.COMPLETED }
log('Actions LIVREUR en COMPLETED', getAvailableActions(livreur, jobCompleted))
console.log('Transition LIVREUR COMPLETED→IN_DELIVERY:', canTransition(livreur, jobCompleted, Status.IN_DELIVERY))

console.log('\nNotifications READY:', getNotifications(jobReady, Status.PREPARATION, Status.READY, admin).map(n => n.type))
console.log('Notifications COMPLETED:', getNotifications(jobCompleted, Status.IN_PROGRESS, Status.COMPLETED, impRoland).map(n => n.type))

console.log('\nPeut supprimer (prep, PREPARATION):', canDeleteJob(prep, job))
console.log('Peut voir (livreur, PREPARATION):', canViewJob(livreur, job))
