import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProducersComponent } from './producers.component';
import { ChainService } from '../../../../services/chain.service';

describe('ProducersComponent', () => {
  let component: ProducersComponent;
  let fixture: ComponentFixture<ProducersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProducersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProducersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides vote and location columns the chain does not publish', () => {
    const chain = TestBed.inject(ChainService);
    (chain.producersResource as any).set({ rows: [{ owner: 'defproducera' }, { owner: 'defproducerb' }] });
    expect(component.displayedColumns()).toEqual(['rank', 'account']);
    (chain.producersResource as any).set({ rows: [{ owner: 'bp1', total_votes: '10.5', location: 76 }] });
    expect(component.displayedColumns()).toEqual(['rank', 'account', 'location', 'total_votes']);
  });
});
