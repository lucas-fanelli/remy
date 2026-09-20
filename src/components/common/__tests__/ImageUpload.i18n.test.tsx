import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import ConfirmDialog from '../ConfirmDialog';
import FormDialog from '../FormDialog';
import ImageUpload from '../ImageUpload';
import { tooLargeMessage, uploadErrorMessage } from '../imageUploadUtils';

/**
 * The editor's shared chrome in Spanish. ImageUpload.test.tsx and the two dialog suites next
 * door assert the English and were not touched; this one proves the same components, and the
 * pure copy of imageUploadUtils, come out in the reader's language.
 */

const theme = createTheme();

const inSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

const noop = () => undefined;

describe('ImageUpload in Spanish', () => {
  it('should invite the author to add a cover photo', () => {
    inSpanish(<ImageUpload value="" onChange={noop} />);

    expect(screen.getByText('Foto de portada')).toBeInTheDocument();
    expect(screen.getByText('Agregá una foto de portada')).toBeInTheDocument();
    expect(screen.getByText('Soltá, pegá o hacé clic - JPG, PNG, WebP o GIF')).toBeInTheDocument();
  });

  it('should name the actions over a photo that is already there', () => {
    inSpanish(
      <ImageUpload value="https://res.cloudinary.com/demo/image/upload/a.jpg" onChange={noop} />
    );

    expect(screen.getByRole('button', { name: 'Reemplazar la foto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar la foto' })).toBeInTheDocument();
  });

  it('should name the inline trigger of a step photo', () => {
    inSpanish(
      <ImageUpload
        variant="inline"
        required={false}
        value=""
        onChange={noop}
        label="Foto del paso 2 (opcional)"
      />
    );

    expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Foto del paso 2 (opcional)' })).toBeInTheDocument();
  });

  it('should render the upload copy the pure helpers named, in Spanish', () => {
    inSpanish(
      <ImageUpload
        value=""
        onChange={noop}
        error
        helperText="Agregá una foto de portada (JPG, PNG, WebP o GIF)"
      />
    );

    expect(
      screen.getByText('Agregá una foto de portada (JPG, PNG, WebP o GIF)')
    ).toBeInTheDocument();
  });
});

describe('the upload messages as descriptors', () => {
  it('should name the too-large message with the sizes as numbers', () => {
    expect(tooLargeMessage(8.2 * 1024 * 1024)).toEqual({
      key: 'recipeForm.photo.tooLarge',
      values: { size: 8.2, max: MAX_UPLOAD_SIZE / (1024 * 1024) },
    });
  });

  it("should hand back the server's own sentence untouched", () => {
    expect(uploadErrorMessage(400, { error: 'No valid file provided' })).toBe(
      'No valid file provided'
    );
  });
});

describe('the editor dialogs in Spanish', () => {
  it('should label the close button of a form dialog', () => {
    inSpanish(
      <FormDialog open title="Nueva receta" onClose={noop} actions={null}>
        <p>Contenido</p>
      </FormDialog>
    );

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nueva receta' })).toBeInTheDocument();
  });

  it('should fall back to the shared Spanish words of a confirmation', () => {
    inSpanish(
      <ConfirmDialog
        open
        onClose={noop}
        onConfirm={noop}
        title="¿Empezar de nuevo?"
        message="Esto no se puede deshacer."
      />
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('should say it is working while a confirmation is in flight', () => {
    inSpanish(
      <ConfirmDialog
        open
        loading
        onClose={noop}
        onConfirm={noop}
        title="¿Empezar de nuevo?"
        message="Esto no se puede deshacer."
      />
    );

    expect(screen.getByRole('button', { name: 'Procesando...' })).toBeInTheDocument();
  });
});
