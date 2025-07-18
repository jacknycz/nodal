import React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export default function TestPDF({ file = '/test.pdf' }: { file?: string }) {
  return (
    <div style={{ width: 600, margin: '2rem auto', background: '#fff', padding: 20, borderRadius: 8 }}>
      <h2>Minimal PDF Viewer Test</h2>
      <Document file={file}>
        <Page pageNumber={1} />
      </Document>
    </div>
  );
} 