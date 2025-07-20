import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.min.js`;

export default function PdfNode({ file = '/test.pdf' }: { file?: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));

  return (
    <div style={{ width: 600, margin: '2rem auto', background: '#fff', padding: 20, borderRadius: 8 }}>
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        loading="Loading PDF..."
        error="Failed to load PDF."
      >
        <Page pageNumber={pageNumber} width={560} />
      </Document>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
          ◀ Prev
        </button>
        <span>
          Page {pageNumber} of {numPages}
        </span>
        <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
          Next ▶
        </button>
      </div>
    </div>
  );
}
