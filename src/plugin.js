const hash = window.top.location.hash;
const queryIndex = hash.indexOf('?');
const queryString = hash.substring(queryIndex + 1);
const params = new URLSearchParams(queryString);
console.log(params);

const teiId = params.get('teiId');
const enrollmentId = params.get('enrollmentId');

document.getElementById('exportBtn').onclick = exportIPS;

async function exportIPS() {
    log('Starting IPS export...');

    try {
        const tei = await fetchJSON(`../../../../api/trackedEntityInstances/${teiId}?fields=attributes`);
        const events = await fetchJSON(`../../../../api/events?enrollment=${enrollmentId}&paging=false`);

        const patient = mapPatient(tei);
        const composition = buildComposition(patient.id);

        const conditions = mapConditions(events.events);
        const allergies = mapAllergies(events.events);
        const medications = mapMedications(events.events);
        const immunizations = mapImmunizations(events.events);
        const observations = mapObservations(events.events);

        const bundle = buildBundle([
            composition,
            patient,
            ...conditions,
            ...allergies,
            ...medications,
            ...immunizations,
            ...observations
        ]);

        //await sendToFHIR(bundle);

        log('IPS export completed successfully');
        console.log('[IPS v0.2.1] Bundle', bundle);

    } catch (e) {
        log('Error: ' + e.message);
        console.error(e);
    }
}

function log(msg) {
    document.getElementById('log').textContent += msg + '\n';
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('DHIS2 API fetch failed');
    return res.json();
}

/* ================= CONFIG ================= */
const CONFIG = {
    fhirServer: 'https://fhir.example.org/Bundle',
    fhirToken: 'REPLACE_WITH_TOKEN',
    stageMap: {
        CONDITIONS: 'DIAGNOSIS_STAGE_UID',
        ALLERGIES: 'ALLERGY_STAGE_UID',
        MEDICATIONS: 'MEDICATION_STAGE_UID',
        IMMUNIZATIONS: 'IMMUNIZATION_STAGE_UID'
    }
};

/* ================= HELPERS ================= */
function getAttr(tei, uid) {
    return tei.attributes?.find(a => a.attribute === uid)?.value || null;
}

function mapGender(val) {
    if (!val) return 'unknown';
    if (val.toLowerCase().startsWith('m')) return 'male';
    if (val.toLowerCase().startsWith('f')) return 'female';
    return 'unknown';
}

/* ================= FHIR MAPPERS ================= */
function mapPatient(tei) {
    return {
        resourceType: 'Patient',
        id: tei.trackedEntity,
        identifier: [{
            system: 'http://national-id.gov.np',
            value: getAttr(tei, 'NATIONAL_ID_UID')
        }],
        name: [{
            given: [getAttr(tei, 'FIRST_NAME_UID')],
            family: getAttr(tei, 'LAST_NAME_UID')
        }],
        gender: mapGender(getAttr(tei, 'GENDER_UID')),
        birthDate: getAttr(tei, 'DOB_UID')
    };
}

function mapConditions(events) {
    return events
        .filter(e => e.programStage === CONFIG.stageMap.CONDITIONS)
        .map(e => ({ resourceType: 'Condition', subject: { reference: 'Patient/' + e.trackedEntity }, recordedDate: e.eventDate, code: { text: e.dataValues?.[0]?.value } }));
}

function mapAllergies(events) {
    return events
        .filter(e => e.programStage === CONFIG.stageMap.ALLERGIES)
        .map(e => ({ resourceType: 'AllergyIntolerance', patient: { reference: 'Patient/' + e.trackedEntity }, code: { text: e.dataValues?.[0]?.value }, clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] } }));
}

function mapMedications(events) {
    return events
        .filter(e => e.programStage === CONFIG.stageMap.MEDICATIONS)
        .map(e => ({ resourceType: 'MedicationStatement', subject: { reference: 'Patient/' + e.trackedEntity }, status: 'active', medicationCodeableConcept: { text: e.dataValues?.[0]?.value }, effectiveDateTime: e.eventDate }));
}

function mapImmunizations(events) {
    return events
        .filter(e => e.programStage === CONFIG.stageMap.IMMUNIZATIONS)
        .map(e => ({ resourceType: 'Immunization', patient: { reference: 'Patient/' + e.trackedEntity }, status: 'completed', vaccineCode: { text: e.dataValues?.[0]?.value }, occurrenceDateTime: e.eventDate }));
}

function mapObservations(events) {
    return events.map(e => ({ resourceType: 'Observation', status: 'final', subject: { reference: 'Patient/' + e.trackedEntity }, effectiveDateTime: e.eventDate, code: { text: e.programStage }, valueString: e.dataValues?.[0]?.value }));
}

/* ================= COMPOSITION ================= */
function buildComposition(patientId) {
    return {
        resourceType: 'Composition',
        status: 'final',
        type: { coding: [{ system: 'http://loinc.org', code: '60591-5', display: 'International Patient Summary' }] },
        subject: { reference: 'Patient/' + patientId },
        date: new Date().toISOString(),
        title: 'International Patient Summary'
    };
}

/* ================= BUNDLE ================= */
function buildBundle(resources) {
    return { resourceType: 'Bundle', type: 'document', entry: resources.map(resource => ({ fullUrl: 'urn:uuid:' + crypto.randomUUID(), resource })) };
}

/* ================= SEND ================= */
async function sendToFHIR(bundle) {
    const res = await fetch(CONFIG.fhirServer, { method: 'POST', headers: { 'Content-Type': 'application/fhir+json', 'Authorization': 'Bearer ' + CONFIG.fhirToken }, body: JSON.stringify(bundle) });
    if (!res.ok) throw new Error('FHIR server rejected bundle');
}
