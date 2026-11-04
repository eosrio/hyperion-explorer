import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BlockService } from '../../../services/block.service';
import { ChainService } from '../../../services/chain.service';
import { DeltaService } from '../../../services/delta.service';
import { DataService } from '../../../services/data.service';
import { SearchService } from '../../../services/search.service';

import { BlockComponent } from './block.component';

describe('BlockComponent', () => {
  let component: BlockComponent;
  let fixture: ComponentFixture<BlockComponent>;

  beforeEach(async () => {
    const value = signal<any>(null);
    await TestBed.configureTestingModule({
      imports: [BlockComponent],
      providers: [
        {provide: BlockService, useValue: {blockId: signal(''), blockNum: signal(0), blockResource: {
          hasValue: () => value() !== null, value, set: (block: unknown) => value.set(block),
          error: () => undefined, isLoading: () => false, reload: vi.fn(() => true)
        }}},
        {provide: ChainService, useValue: {lastIrreversibleBlockNum: signal(100)}},
        {provide: DeltaService, useValue: {blockId: signal(null), blockNum: signal(null), reloadCurrentBlock: vi.fn(),
          deltasResource: {hasValue: () => false, error: () => undefined, isLoading: () => false}}},
        {provide: DataService, useValue: {explorerMetadata: signal({chain_name: 'Wire Testnet'})}},
        {provide: SearchService, useValue: {searchType: signal(''), searchQuery: signal('')}}
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlockComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels header-only results without presenting missing history as zero transactions', async () => {
    component.blockService.blockResource.set({
      id: '00000064' + 'a'.repeat(56), number: 100, previous_id: '00000063' + 'b'.repeat(56),
      producer: 'producer', timestamp: '2026-11-04T14:44:00.000', transactions: [], historyUnavailable: true
    });
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.textContent).toContain('Block header available.');
    expect(page.textContent).toContain('Transaction and action details are temporarily unavailable from history.');
    expect(page.textContent).not.toContain('0 returned transactions');
    expect(page.querySelector('.transactions-table')).toBeNull();
    expect([...page.querySelectorAll('a')].some(link => link.href.endsWith('/block/101'))).toBe(true);
  });

  it('renders an actual empty history result without a header-only warning', async () => {
    component.blockService.blockResource.set({
      id: '00000064' + 'a'.repeat(56), number: 100, previous_id: '00000063' + 'b'.repeat(56),
      next_id: '00000065' + 'c'.repeat(56), producer: 'producer', timestamp: '2026-11-04T14:44:00.000', transactions: []
    });
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.textContent).toContain('0 returned transactions');
    expect(page.textContent).not.toContain('Block header available.');
  });

  it('refreshes both history and the current delta cache on retry', async () => {
    component.blockService.blockResource.set({
      id: '00000064' + 'a'.repeat(56), number: 100, previous_id: '00000063' + 'b'.repeat(56),
      producer: 'producer', timestamp: '2026-11-04T14:44:00.000', transactions: [], historyUnavailable: true
    });
    await fixture.whenStable();
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
      .find(button => button.textContent?.includes('Retry history'))!;
    button.click();
    await fixture.whenStable();
    expect(component.deltaService.reloadCurrentBlock).toHaveBeenCalledTimes(1);
    expect(component.blockService.blockResource.reload).toHaveBeenCalledTimes(1);
  });
});
