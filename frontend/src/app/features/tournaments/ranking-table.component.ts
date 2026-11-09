import { Component, computed, input } from '@angular/core';
import { RankingRow } from './tournament.models';
import { FormDotsComponent, TeamBadgeComponent } from './tournament-ui';

/** Tableau de classement (réutilisé par la fiche tournoi et la page Classement). */
@Component({
  selector: 'app-ranking-table',
  imports: [FormDotsComponent, TeamBadgeComponent],
  template: `
    @if (rows().length === 0) {
      <p class="empty">Aucun match terminé : saisissez des scores pour faire apparaître le classement.</p>
    } @else {
      <div class="table-wrap">
        <table class="ranking">
          <thead>
            <tr>
              <th>#</th><th>Équipe</th><th class="num">Elo</th>
              <th class="num" title="Joués">J</th><th class="num" title="Victoires">V</th>
              <th class="num" title="Nuls">N</th><th class="num" title="Défaites">D</th>
              <th class="num" title="Différence de buts">+/-</th><th class="num">Pts</th><th>Forme</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.team_id) {
              <tr [class.top]="r.position <= 3">
                <td><span class="rank" [attr.data-pos]="r.position">{{ r.position }}</span></td>
                <td class="team-cell"><app-team-badge [name]="r.team_name" /> {{ r.team_name ?? 'Équipe #' + r.team_id }}</td>
                <td class="num">
                  <div class="elo-cell" [class.strong]="orderBy() === 'elo'">
                    <span class="elo-bar" [style.width.%]="bar(r.elo)"></span><b>{{ r.elo.toFixed(0) }}</b>
                  </div>
                </td>
                <td class="num">{{ r.played }}</td>
                <td class="num">{{ r.wins }}</td>
                <td class="num">{{ r.draws }}</td>
                <td class="num">{{ r.losses }}</td>
                <td class="num" [class.pos]="r.goal_difference > 0" [class.neg]="r.goal_difference < 0">
                  {{ r.goal_difference > 0 ? '+' : '' }}{{ r.goal_difference }}
                </td>
                <td class="num"><b [class.strong]="orderBy() === 'points'">{{ r.points }}</b></td>
                <td><app-form-dots [form]="r.form" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class RankingTableComponent {
  rows = input.required<RankingRow[]>();
  orderBy = input<'elo' | 'points'>('elo');

  private range = computed(() => {
    const elos = this.rows().map((r) => r.elo);
    return { min: Math.min(...elos), max: Math.max(...elos) };
  });

  /** Largeur de la barre Elo, de 20 % (plus faible) à 100 % (meilleure). */
  bar(elo: number) {
    const { min, max } = this.range();
    return max === min ? 60 : 20 + ((elo - min) / (max - min)) * 80;
  }
}
