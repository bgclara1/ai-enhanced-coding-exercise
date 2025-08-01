import React, { useState, useEffect } from 'react';

import { getLLMConfig } from '../config';
import { extractFlashcards } from '../services/llmService';
import { fetchWikipediaContent } from '../services/wikipediaService';
import { FlashcardSet } from '../types';

import { MockModeToggle } from './MockModeToggle';
import '../styles/InputForm.css';

interface InputFormProps {
  setFlashcardSet: React.Dispatch<React.SetStateAction<FlashcardSet | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const InputForm: React.FC<InputFormProps> = ({ setFlashcardSet, setLoading, setError }) => {
  const [isUrlInput, setIsUrlInput] = useState(true);
  const [input, setInput] = useState('');
  const [useMockMode, setUseMockMode] = useState(false);

  useEffect(() => {
    const savedSetting = localStorage.getItem('use_mock_mode');
    if (savedSetting !== null && savedSetting !== '') {
      setUseMockMode(savedSetting === 'true');
    }
  }, []);

  const isValidWikipediaUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname === 'en.wikipedia.org'
        || parsedUrl.hostname === 'wikipedia.org'
      );
    } catch (error) {
      return false;
    }
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      const title = pathParts[pathParts.length - 1];
      return title.replace(/_/g, ' ');
    } catch (error) {
      return 'Wikipedia Article';
    }
  };
  const handleFileImport = async (file: File, fileType: 'json' | 'csv'): Promise<void> => {
    setError(null);
    setLoading(true);

    try {
      const text = await file.text();
      let flashcardSet: FlashcardSet;

      if (fileType === 'json') {
        const data = JSON.parse(text);
        flashcardSet = validateAndParseJsonFlashcards(data, file.name);
      } else {
        flashcardSet = parseCSVFlashcards(text, file.name);
      }

      setFlashcardSet(flashcardSet);
    } catch (error) {
      setError(`Error importing ${fileType.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const validateAndParseJsonFlashcards = (data: any, fileName: string): FlashcardSet => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format');
    }

    // Support both direct array of cards and FlashcardSet object
    let cards: any[];
    let title = fileName.replace(/\.json$/i, '');
    let source = `Imported from ${fileName}`;

    if (Array.isArray(data)) {
      cards = data;
    } else if (data.cards && Array.isArray(data.cards)) {
      cards = data.cards;
      title = data.title || title;
      source = data.source || source;
    } else {
      throw new Error('JSON must contain an array of flashcards or a FlashcardSet object with a cards array');
    }

    const validatedCards = cards.map((card, index) => {
      if (!card || typeof card !== 'object') {
        throw new Error(`Invalid card at position ${index + 1}`);
      }
      if (!card.question || !card.answer) {
        throw new Error(`Card at position ${index + 1} must have both question and answer fields`);
      }
      return {
        id: card.id || `imported-${index + 1}`,
        question: String(card.question).trim(),
        answer: String(card.answer).trim(),
      };
    });

    if (validatedCards.length === 0) {
      throw new Error('No valid flashcards found in the file');
    }

    return {
      title,
      source,
      cards: validatedCards,
      createdAt: new Date(),
    };
  };

  const parseCSVFlashcards = (csvText: string, fileName: string): FlashcardSet => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain at least a header row and one data row');
    }

    const header = lines[0].split(',').map(col => col.trim().toLowerCase().replace(/"/g, ''));
    const questionIndex = header.findIndex(col => col.includes('question'));
    const answerIndex = header.findIndex(col => col.includes('answer'));

    if (questionIndex === -1 || answerIndex === -1) {
      throw new Error('CSV must contain columns with "question" and "answer" in their names');
    }

    const cards = lines.slice(1).map((line, index) => {
      const columns = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
      
      if (columns.length <= Math.max(questionIndex, answerIndex)) {
        throw new Error(`Row ${index + 2} does not have enough columns`);
      }

      const question = columns[questionIndex]?.trim();
      const answer = columns[answerIndex]?.trim();

      if (!question || !answer) {
        throw new Error(`Row ${index + 2} has empty question or answer`);
      }

      return {
        id: `imported-csv-${index + 1}`,
        question,
        answer,
      };
    });

    if (cards.length === 0) {
      throw new Error('No valid flashcards found in the CSV file');
    }

    return {
      title: fileName.replace(/\.csv$/i, ''),
      source: `Imported from ${fileName}`,
      cards,
      createdAt: new Date(),
    };
  };

  const handleImportClick = (fileType: 'json' | 'csv'): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = fileType === 'json' ? '.json' : '.csv';
    input.onchange = (e): void => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileImport(file, fileType).catch(() => {
          // Error handled in handleFileImport
        });
      }
    };
    input.click();
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError('Please enter a Wikipedia URL or text');
      return;
    }

    const config = getLLMConfig();

    if (config.defaultApiKey === undefined || config.defaultApiKey === '' || config.defaultApiKey.trim() === '') {
      setError('Please set your API key in LLM Settings');
      return;
    }

    setLoading(true);

    try {
      let content = input;
      let source = 'Custom text';

      if (isUrlInput) {
        if (!isValidWikipediaUrl(input)) {
          setError('Please enter a valid Wikipedia URL');
          setLoading(false);
          return;
        }

        const wikiContent = await fetchWikipediaContent(input);
        content = wikiContent.content;
        source = input;
      }

      const flashcards = await extractFlashcards(content, undefined, useMockMode);

      setFlashcardSet({
        title: isUrlInput ? extractTitleFromUrl(input) : 'Custom Text Flashcards',
        source,
        cards: flashcards,
        createdAt: new Date(),
      });
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="input-form-container">
      <form
        onSubmit={(e): void => {
          handleSubmit(e).catch((_) => { /* Error handled in handleSubmit */ });
        }}
      >
        <div className="input-type-selector">
          <button
            type="button"
            className={isUrlInput === true ? 'active' : ''}
            onClick={(): void => setIsUrlInput(true)}
          >
            Wikipedia URL
          </button>
          <button
            type="button"
            className={isUrlInput === false ? 'active' : ''}
            onClick={(): void => setIsUrlInput(false)}
          >
            Custom Text
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="input">
            {isUrlInput ? 'Wikipedia URL' : 'Text to extract flashcards from'}
          </label>
          <textarea
            id="input"
            value={input}
            onChange={(e): void => setInput(e.target.value)}
            placeholder={
              isUrlInput
                ? 'https://en.wikipedia.org/wiki/Artificial_intelligence'
                : 'Paste your text here...'
            }
            rows={isUrlInput ? 1 : 10}
          />
        </div>

        <MockModeToggle onChange={setUseMockMode} />

        <button className="submit-button" type="submit">Generate Flashcards</button>
      </form>
      
      <div className="import-section">
        <div className="import-divider">
          <span>OR</span>
        </div>
        <div className="import-buttons">
          <button 
            type="button" 
            className="import-button import-json"
            onClick={(): void => handleImportClick('json')}
          >
            Import from JSON
          </button>
          <button 
            type="button" 
            className="import-button import-csv"
            onClick={(): void => handleImportClick('csv')}
          >
            Import from CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputForm;
