<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;

/**
 * Bank form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'name',
                null,
                array(
                    'label' => 'bank_name',
                    'attr' => array('size' => 40)
                )
            )
        ;

        $builder->addEventListener(
            FormEvents::PRE_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $bank = $event->getData();

                $user = $bank->getUser();

                $edit = (null !== $bank->getBankId());

                $form
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'provider',
                            'entity',
                            null,
                            array(
                                'label' => 'bank_provider',
                                'empty_value' => 'bank_provider_other',
                                'empty_data' => null,
                                'class' => 'Krevindiou\BagheeraBundle\Entity\Provider',
                                'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($user) {
                                    return $repository->createQueryBuilder('p')
                                        ->where('p.country = :country')
                                        ->setParameter('country', $user->getCountry())
                                        ->add('orderBy', 'p.name ASC');
                                },
                                'disabled' => $edit,
                                'attr' => array(
                                    'bankId' => $bank->getBankId()
                                )
                            )
                        )
                    )
                ;
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Bank'
            )
        );
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_banktype';
    }
}
