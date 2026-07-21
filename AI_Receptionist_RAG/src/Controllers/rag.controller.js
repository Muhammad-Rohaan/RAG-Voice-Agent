import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';


/*
import path from 'path';
import { fileURLToPath } from 'url';

export const loadDocs = async function () {

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);

    const akuhDeptDocs = [
        path.join(dirname, '../Docs/dentistry_department.pdf'),
        path.join(dirname, '../Docs/dermatology_department.pdf'),
        path.join(dirname, '../Docs/emergency_medicine_department.pdf'),
        path.join(dirname, '../Docs/endocrinology_department.pdf'),
        path.join(dirname, '../Docs/ent_department.pdf'),
        path.join(dirname, '../Docs/gastroenterology_department.pdf'),
        path.join(dirname, '../Docs/nephrology_urology_department.pdf'),
        path.join(dirname, '../Docs/neurology_department.pdf'),
        path.join(dirname, '../Docs/ophthalmology_department.pdf'),
        path.join(dirname, '../Docs/orthopaedics_department.pdf'),
        path.join(dirname, '../Docs/psychiatry_department.pdf'),
        path.join(dirname, '../Docs/radiology_department.pdf')
    ];

    console.log(akuhDeptDocs);

    const allDocs = [];

    for (const filePath of akuhDeptDocs) {
        const pdfLoader = new PDFLoader(filePath);
        const rawDocs = await pdfLoader.load();
    }

}
*/

export const loadDocs = async () => {

    const akuhDeptDocs = [
        "../src/Docs/dentistry_department.pdf",
        "../src/Docs/dermatology_department.pdf",
        "../src/Docs/emergency_medicine_department.pdf",
        "../src/Docs/endocrinology_department.pdf",
        "../src/Docs/ent_department.pdf",
        "../src/Docs/gastroenterology_department.pdf",
        "../src/Docs/nephrology_urology_department.pdf",
        "../src/Docs/neurology_department.pdf",
        "../src/Docs/ophthalmology_department.pdf",
        "../src/Docs/orthopaedics_department.pdf",
        "../src/Docs/psychiatry_department.pdf",
        "../src/Docs/radiology_department.pdf",
    ];

    const allDocs = [];

    for (const filePath of akuhDeptDocs) {
        const pdfLoader = new PDFLoader(filePath);
        const rawDocs = await pdfLoader.load();
        allDocs.push(...rawDocs)
    }

    return allDocs;
}

export const createChunks = async (docs) => {
    // let chunkedDocs;
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
    });

    if (!docs || docs.length === 0) {
        console.log("No documents to split into chunks.");
        return [];
    }

    const chunkedDocs = await textSplitter.splitDocuments(docs);

    return chunkedDocs;
}
