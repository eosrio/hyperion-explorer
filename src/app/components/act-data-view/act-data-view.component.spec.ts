import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActDataViewComponent, decodeSymbolCode, symbolFromScope } from './act-data-view.component';

describe('ActDataViewComponent', () => {
  let component: ActDataViewComponent;
  let fixture: ComponentFixture<ActDataViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActDataViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActDataViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reads token stat scopes back as their symbol', () => {
    expect(symbolFromScope('........ehgp3')).toBe('SYS');
    expect(symbolFromScope('......25ed4pb')).toBe('WIRE');
    expect(symbolFromScope('.............')).toBeNull();
    expect(symbolFromScope('alice')).toBeNull();
  });

  it('decodes raw symbol codes and leaves other numbers alone', () => {
    expect(decodeSymbolCode(1163020631)).toBe('WIRE');
    expect(decodeSymbolCode('5459781')).toBe('EOS');
    expect(decodeSymbolCode(42)).toBeNull();
    expect(decodeSymbolCode(0)).toBeNull();
    expect(decodeSymbolCode(-5)).toBeNull();
    fixture.componentRef.setInput('data', { sym_code: 1163020631, amount: 1163020631 });
    fixture.detectChanges();
    const values = Array.from(fixture.nativeElement.querySelectorAll('dd') as NodeListOf<HTMLElement>).map(dd => dd.textContent!.replace(/\s+/g, ' ').trim());
    expect(values).toEqual(['WIRE (raw 1163020631)', '1163020631']);
  });
});
