import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

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
    <div 
        className="bg-white p-4 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        loading="Loading PDF..."
        error="Failed to load PDF."
      >
        <Page pageNumber={pageNumber} width={820} />
      </Document>

      <div 
        className="mt-4 flex justify-between items-center"
      >
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
