import React, { useState, useEffect, useRef } from 'react';
import { extractFlashcards } from '../services/llmService';
import { fetchWikipediaContent } from '../services/wikipediaService';
import { FlashcardSet, Flashcard } from '../types';
import { getLLMConfig } from '../config';
import { MockModeToggle } from './MockModeToggle';
import { v4 as uuidv4 } from 'uuid';
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
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const savedSetting = localStorage.getItem('use_mock_mode');
    if (savedSetting) {
      setUseMockMode(savedSetting === 'true');
    }
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError('Please enter a Wikipedia URL or text');
      return;
    }

    const config = getLLMConfig();
    
    if (!config.defaultApiKey || !config.defaultApiKey.trim()) {
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
        source: source,
        cards: flashcards,
        createdAt: new Date()
      });
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const isValidWikipediaUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.includes('wikipedia.org') && parsedUrl.pathname.length > 1;
    } catch {
      return false;
    }
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      return lastPart.replace(/_/g, ' ');
    } catch {
      return 'Wikipedia Flashcards';
    }
  };

  const handleImportJSON = () => {
    if (jsonFileInputRef.current) {
      jsonFileInputRef.current.click();
    }
  };

  const handleImportCSV = () => {
    if (csvFileInputRef.current) {
      csvFileInputRef.current.click();
    }
  };

  const handleJSONFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please select a valid JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Validate the JSON structure
        if (!data.cards || !Array.isArray(data.cards)) {
          throw new Error('Invalid JSON format: missing or invalid cards array');
        }

        // Validate each card has required fields
        const validatedCards: Flashcard[] = data.cards.map((card: any, index: number) => {
          if (!card.question || !card.answer) {
            throw new Error(`Invalid card at index ${index}: missing question or answer`);
          }
          return {
            id: card.id || uuidv4(),
            question: String(card.question),
            answer: String(card.answer)
          };
        });

        const flashcardSet: FlashcardSet = {
          title: data.title || 'Imported JSON Flashcards',
          source: 'JSON Import',
          cards: validatedCards,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
        };

        setFlashcardSet(flashcardSet);
        setError(null);
      } catch (error) {
        setError(`Error importing JSON: ${error instanceof Error ? error.message : 'Invalid file format'}`);
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
    };

    reader.readAsText(file);
    // Reset the input value to allow re-importing the same file
    event.target.value = '';
  };

  const handleCSVFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('CSV file must contain at least a header row and one data row');
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const questionIndex = headers.findIndex(h => h === 'question');
        const answerIndex = headers.findIndex(h => h === 'answer');

        if (questionIndex === -1 || answerIndex === -1) {
          throw new Error('CSV file must contain "Question" and "Answer" columns');
        }

        const cards: Flashcard[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
          
          if (values.length <= Math.max(questionIndex, answerIndex)) {
            continue; // Skip incomplete rows
          }

          const question = values[questionIndex];
          const answer = values[answerIndex];

          if (question && answer) {
            cards.push({
              id: uuidv4(),
              question,
              answer
            });
          }
        }

        if (cards.length === 0) {
          throw new Error('No valid flashcards found in CSV file');
        }

        const flashcardSet: FlashcardSet = {
          title: 'Imported CSV Flashcards',
          source: 'CSV Import',
          cards,
          createdAt: new Date()
        };

        setFlashcardSet(flashcardSet);
        setError(null);
      } catch (error) {
        setError(`Error importing CSV: ${error instanceof Error ? error.message : 'Invalid file format'}`);
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
    };

    reader.readAsText(file);
    // Reset the input value to allow re-importing the same file
    event.target.value = '';
  };

  return (
    <div className="input-form-container">
      <form onSubmit={handleSubmit}>
        <div className="input-type-selector">
          <button
            type="button"
            className={isUrlInput ? 'active' : ''}
            onClick={() => setIsUrlInput(true)}
          >
            Wikipedia URL
          </button>
          <button
            type="button"
            className={!isUrlInput ? 'active' : ''}
            onClick={() => setIsUrlInput(false)}
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
            onChange={(e) => setInput(e.target.value)}
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
        <h3>Or Import Existing Flashcards</h3>
        <div className="import-buttons">
          <button 
            type="button" 
            className="import-button json-import"
            onClick={handleImportJSON}
          >
            📄 Import JSON
          </button>
          <button 
            type="button" 
            className="import-button csv-import"
            onClick={handleImportCSV}
          >
            📊 Import CSV
          </button>
        </div>
        
        <input
          ref={jsonFileInputRef}
          type="file"
          accept=".json"
          onChange={handleJSONFileChange}
          style={{ display: 'none' }}
        />
        
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVFileChange}
          style={{ display: 'none' }}
        />
        
        <div className="import-info">
          <p><strong>JSON Format:</strong> Use exported JSON files from this app</p>
          <p><strong>CSV Format:</strong> Must have "Question" and "Answer" columns</p>
        </div>
      </div>
    </div>
  );
};

export default InputForm;
